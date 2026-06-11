"""
API routes for architectural characteristics detection and prioritization.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.deps import get_characteristics_service
from application.characteristics_service import CharacteristicsService
from infrastructure.session_storage import SessionStorage, get_storage

logger = logging.getLogger(__name__)

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
    summary: Optional[str] = Field(default=None, description="≤15-word plain-language reason")
    rationale: str = Field(description="Why this matters for THIS system")
    source: str = Field(description="ai_detected | user_adjusted | manual")
    locked: bool = Field(description="Whether user has finalized priorities")
    history: List[dict[str, Any]] = Field(description="Audit trail of changes")


class DetectRequest(BaseModel):
    """Request to detect characteristics from spec."""
    session_id: str
    force: bool = False  # Set True to bypass cache and re-run detection


class DetectResponse(BaseModel):
    """Response with detected characteristics."""
    session_id: str
    characteristics: List[CharacteristicOut]
    detected_at: str
    count: int = Field(description="Number of characteristics detected (0-12)")


class CharacteristicItem(BaseModel):
    """Validated shape of a single characteristic in an update-priorities request."""
    id: str
    label: str
    priority: int = Field(ge=1, le=10)
    confidence: int = Field(ge=0, le=100)
    evidence: List[str] = []
    summary: Optional[str] = None
    rationale: str = ""
    source: str = "ai_detected"
    locked: bool = False
    history: List[dict[str, Any]] = []


class UpdatePrioritiesRequest(BaseModel):
    """Request to update characteristic priorities after user reordering."""
    session_id: str
    characteristics: List[CharacteristicItem] = Field(
        description="Full characteristic objects with updated priorities"
    )


class UpdatePrioritiesResponse(BaseModel):
    """Confirmation of priority update."""
    session_id: str
    status: str
    updated_at: str


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

    Idempotent: if characteristics have already been detected for this session,
    the cached result is returned immediately without re-running the LLM.
    Pass force=true in the request body to override and re-detect.
    """

    logger.info("[CharacteristicsAPI] Detect request for session: %s", body.session_id)

    if not storage.session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    # Idempotency: return cached result if detection has already run
    existing = storage.read_characteristics(body.session_id)
    if existing and existing.get("characteristics") and not body.force:
        cached = existing["characteristics"]
        logger.info("[CharacteristicsAPI] Returning cached characteristics (%d items)", len(cached))
        return DetectResponse(
            session_id=body.session_id,
            characteristics=[CharacteristicOut(**c) for c in cached],
            detected_at=existing.get("detected_at", ""),
            count=len(cached),
        )

    spec_text = storage.read_input_md(body.session_id)
    if not spec_text:
        raise HTTPException(
            status_code=400,
            detail="No specification found. Please upload documents first."
        )

    logger.info("[CharacteristicsAPI] Running detection on spec (%d chars)…", len(spec_text))

    characteristics = await char_svc.detect_characteristics(spec_text)

    timestamp = datetime.now(timezone.utc).isoformat()
    storage.write_characteristics(
        body.session_id,
        {
            "characteristics": characteristics,
            "detected_at": timestamp,
            "user_finalized_at": None,
        }
    )

    logger.info("[CharacteristicsAPI] Detected and cached %d characteristics", len(characteristics))

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
    User manually adjusts characteristic priorities (drag-and-drop reordering).

    Only characteristics whose priority actually changed are marked user_adjusted.
    Items added manually by the user keep source='manual'.
    """

    logger.info("[CharacteristicsAPI] Updating priorities for session: %s", body.session_id)

    if not storage.session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    char_data = storage.read_characteristics(body.session_id)
    if not char_data:
        raise HTTPException(
            status_code=400,
            detail="No characteristics found. Run detection first."
        )

    # Build a lookup of existing priorities so we only stamp changed items
    existing_priorities: dict[str, int] = {
        c["id"]: c.get("priority", 5)
        for c in char_data.get("characteristics", [])
    }

    timestamp = datetime.now(timezone.utc).isoformat()
    updated_characteristics: list[dict[str, Any]] = []

    for char in body.characteristics:
        d = char.model_dump()

        # Only update source if priority genuinely changed (and not manually added)
        if d["source"] != "manual":
            old_priority = existing_priorities.get(d["id"])
            if old_priority is not None and old_priority != d["priority"]:
                d["source"] = "user_adjusted"

        d.setdefault("history", [])
        d["history"].append({
            "phase": "user_prioritization",
            "priority": d["priority"],
            "timestamp": timestamp,
        })

        logger.debug("  - %s: priority → %d/10 source=%s", d["label"], d["priority"], d["source"])
        updated_characteristics.append(d)

    storage.write_characteristics(
        body.session_id,
        {
            "characteristics": updated_characteristics,
            "detected_at": char_data.get("detected_at"),
            "user_finalized_at": timestamp,
        }
    )

    logger.info("[CharacteristicsAPI] Updated %d priorities", len(updated_characteristics))

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
    """Retrieve existing characteristics for a session."""

    logger.info("[CharacteristicsAPI] Fetching characteristics for session: %s", session_id)

    if not storage.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")

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
