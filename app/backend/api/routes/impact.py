"""
Impact analysis API endpoints.
Analyzes trade-offs when users select non-recommended solutions.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.deps import get_impact_service
from api.routes.auth import get_current_user
from application.impact_service import ImpactAnalysisService
from infrastructure.database import UserDocument
from infrastructure.session_storage import SessionStorage, get_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/impact", tags=["impact"])


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class AffectedCharacteristic(BaseModel):
    """A characteristic affected by the user's choice."""
    characteristic_id: str
    characteristic_label: str
    user_priority: int = Field(ge=1, le=10)
    impact: str = Field(description="positive | negative | neutral")
    magnitude: str = Field(description="minor | moderate | major")
    reasoning: str


class ImpactAnalysisRequest(BaseModel):
    """Request to analyze solution impact."""
    session_id: str
    question_id: str
    chosen_solution_id: str


class ImpactAnalysisResponse(BaseModel):
    """Response with impact analysis."""
    severity: str = Field(description="low | moderate | high")
    is_recommended: bool
    affected_characteristics: List[AffectedCharacteristic]
    summary: str
    recommendation_rationale: str
    tradeoff_insight: str
    chosen_solution: Dict[str, str] = Field(default_factory=dict)
    recommended_solution: Dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=ImpactAnalysisResponse)
async def analyze_solution_impact(
    body: ImpactAnalysisRequest,
    impact_svc: ImpactAnalysisService = Depends(get_impact_service),
    storage: SessionStorage = Depends(get_storage),
    current_user: UserDocument = Depends(get_current_user),
) -> ImpactAnalysisResponse:
    """
    Analyze the impact of choosing a solution vs. the recommended solution.

    This endpoint is called when:
    1. User selects a non-recommended solution in interview
    2. Frontend needs to show trade-off warning modal

    Process:
    1. Load user's prioritized characteristics
    2. Load the interview question and solutions
    3. Compare chosen vs. recommended solution
    4. Return severity and affected characteristics
    """

    logger.info("[ImpactAPI] Analyzing impact — session=%s question=%s chosen=%s",
                body.session_id, body.question_id, body.chosen_solution_id)

    # Verify session exists
    if not storage.session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    # Load characteristics
    char_data = storage.read_characteristics(body.session_id)
    if not char_data or not char_data.get("characteristics"):
        raise HTTPException(
            status_code=400,
            detail="No characteristics found. Complete characteristics phase first."
        )

    characteristics = char_data["characteristics"]

    # Load questions
    questions = storage.read_questions(body.session_id)
    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No questions found. Start interview first."
        )

    # Find the specific question
    question = next((q for q in questions if q["id"] == body.question_id), None)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question {body.question_id} not found"
        )

    # Find recommended and chosen solutions
    recommended_solution = next((s for s in question["solutions"] if s.get("recommended")), None)
    if not recommended_solution:
        raise HTTPException(
            status_code=400,
            detail="No recommended solution found for this question"
        )

    chosen_solution = next((s for s in question["solutions"] if s["id"] == body.chosen_solution_id), None)
    if not chosen_solution:
        raise HTTPException(
            status_code=404,
            detail=f"Solution {body.chosen_solution_id} not found"
        )

    # Perform impact analysis
    analysis = await impact_svc.analyze_impact(
        characteristics=characteristics,
        question=question,
        recommended_solution=recommended_solution,
        chosen_solution=chosen_solution
    )

    logger.info("[ImpactAPI] Analysis complete — severity=%s", analysis["severity"])

    return ImpactAnalysisResponse(
        severity=analysis["severity"],
        is_recommended=analysis.get("is_recommended", False),
        affected_characteristics=[
            AffectedCharacteristic(**char)
            for char in analysis.get("affected_characteristics", [])
        ],
        summary=analysis.get("summary", ""),
        recommendation_rationale=analysis.get("recommendation_rationale", ""),
        tradeoff_insight=analysis.get("tradeoff_insight", ""),
        chosen_solution=analysis.get("chosen_solution", {}),
        recommended_solution=analysis.get("recommended_solution", {})
    )
