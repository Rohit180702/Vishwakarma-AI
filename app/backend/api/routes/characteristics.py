"""
API routes for architectural characteristics detection and prioritization.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from application.characteristics_service import CharacteristicsService
from infrastructure.session_storage import SessionStorage, get_storage

router = APIRouter(prefix="/characteristics", tags=["characteristics"])


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class CharacteristicOut(BaseModel):
    """Single architectural characteristic with metadata."""
    id: str
    label: str
    priority: int = Field(ge=1, le=10, description="Priority 1-10")
    confidence: int = Field(ge=0, le=100, description="Detection confidence 0-100%")
    evidence: List[str] = Field(description="Spec quotes supporting detection")
    rationale: str = Field(description="Why this matters for THIS system")
    source: str = Field(description="ai_detected | user_adjusted | interview_revealed")
    locked: bool = Field(description="Whether user has finalized priorities")
    history: List[dict[str, Any]] = Field(description="Audit trail of changes")


class DetectRequest(BaseModel):
    """Request to detect characteristics from spec."""
    session_id: str


class DetectResponse(BaseModel):
    """Response with detected characteristics."""
    session_id: str
    characteristics: List[CharacteristicOut]
    detected_at: str
    count: int = Field(description="Number of characteristics detected (0-12)")


class UpdatePrioritiesRequest(BaseModel):
    """Request to update characteristic priorities after user reordering."""
    session_id: str
    characteristics: List[dict[str, Any]] = Field(
        description="Full characteristic objects with updated priorities"
    )


class UpdatePrioritiesResponse(BaseModel):
    """Confirmation of priority update."""
    session_id: str
    status: str
    updated_at: str


# ---------------------------------------------------------------------------
# Dependency Injection
# ---------------------------------------------------------------------------

def get_characteristics_service() -> CharacteristicsService:
    """Provide CharacteristicsService instance."""
    return CharacteristicsService()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/detect", response_model=DetectResponse)
async def detect_characteristics(
    body: DetectRequest,
    char_svc: CharacteristicsService = Depends(get_characteristics_service),
    storage: SessionStorage = Depends(get_storage),
) -> DetectResponse:
    """
    Analyze specification and detect architectural characteristics.

    This is Phase 2a: AI-driven characteristic detection.

    Process:
    1. Read spec from session storage (input.md)
    2. Call CharacteristicsService to analyze and detect
    3. Save results to characteristics.json
    4. Return to frontend for user review

    Returns 0-12 characteristics based on evidence in spec.
    """

    print(f"\n[CharacteristicsAPI] Detecting characteristics for session: {body.session_id}")

    # Verify session exists
    if not storage.session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    # Load specification
    spec_text = storage.read_input_md(body.session_id)
    if not spec_text:
        raise HTTPException(
            status_code=400,
            detail="No specification found. Please upload documents first."
        )

    print(f"[CharacteristicsAPI] Loaded spec: {len(spec_text)} chars")

    # Detect characteristics
    characteristics = await char_svc.detect_characteristics(spec_text)

    # Save to storage
    timestamp = datetime.now(timezone.utc).isoformat()
    storage.write_characteristics(
        body.session_id,
        {
            "characteristics": characteristics,
            "detected_at": timestamp,
            "user_finalized_at": None,
        }
    )

    print(f"[CharacteristicsAPI] Saved {len(characteristics)} characteristics")

    return DetectResponse(
        session_id=body.session_id,
        characteristics=[CharacteristicOut(**c) for c in characteristics],
        detected_at=timestamp,
        count=len(characteristics),
    )


@router.post("/update-priorities", response_model=UpdatePrioritiesResponse)
async def update_priorities(
    body: UpdatePrioritiesRequest,
    storage: SessionStorage = Depends(get_storage),
) -> UpdatePrioritiesResponse:
    """
    User manually adjusts characteristic priorities.

    This is Phase 2b: User prioritization via drag-and-drop UI.

    Process:
    1. Load existing characteristics
    2. Update priorities and add history entry
    3. Mark source as 'user_adjusted'
    4. Save back to storage

    This becomes the "application-wide" priority baseline for interview phase.
    """

    print(f"\n[CharacteristicsAPI] Updating priorities for session: {body.session_id}")

    # Verify session exists
    if not storage.session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    # Load existing characteristics
    char_data = storage.read_characteristics(body.session_id)
    if not char_data:
        raise HTTPException(
            status_code=400,
            detail="No characteristics found. Run detection first."
        )

    # Update with user's priorities
    timestamp = datetime.now(timezone.utc).isoformat()
    updated_characteristics = body.characteristics

    for char in updated_characteristics:
        # Add history entry
        if 'history' not in char:
            char['history'] = []

        char['history'].append({
            'phase': 'user_prioritization',
            'priority': char.get('priority', 5),
            'timestamp': timestamp
        })

        # Mark as user-adjusted
        char['source'] = 'user_adjusted'

        print(f"  - {char['label']}: priority updated to {char['priority']}/10")

    # Save updated characteristics
    storage.write_characteristics(
        body.session_id,
        {
            "characteristics": updated_characteristics,
            "detected_at": char_data.get("detected_at"),
            "user_finalized_at": timestamp,
        }
    )

    print(f"[CharacteristicsAPI] Updated {len(updated_characteristics)} priorities")

    return UpdatePrioritiesResponse(
        session_id=body.session_id,
        status="updated",
        updated_at=timestamp,
    )


@router.get("/{session_id}", response_model=DetectResponse)
async def get_characteristics(
    session_id: str,
    storage: SessionStorage = Depends(get_storage),
) -> DetectResponse:
    """
    Retrieve existing characteristics for a session.

    Used when user navigates back to characteristics page
    or when interview phase needs to load priorities.
    """

    print(f"\n[CharacteristicsAPI] Fetching characteristics for session: {session_id}")

    # Verify session exists
    if not storage.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    # Load characteristics
    char_data = storage.read_characteristics(session_id)
    if not char_data or not char_data.get("characteristics"):
        raise HTTPException(
            status_code=404,
            detail="No characteristics found for this session"
        )

    characteristics = char_data["characteristics"]
    detected_at = char_data.get("detected_at", "")

    return DetectResponse(
        session_id=session_id,
        characteristics=[CharacteristicOut(**c) for c in characteristics],
        detected_at=detected_at,
        count=len(characteristics),
    )
