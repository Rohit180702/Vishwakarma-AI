"""
Interview API endpoints for interactive spec enhancement.

Storage layout (per session, on disk):
  questions.json  ← Claude-generated questions, written at /start
  answers.json    ← user decisions, appended after each answer/skip
Current question index = len(answers); completed = len(answers) == len(questions).

POST /api/v1/interview/start          → generate questions, write questions.json
POST /api/v1/interview/answer         → append to answers.json
POST /api/v1/interview/skip           → append recommended answer to answers.json
POST /api/v1/interview/skip-all       → fill remaining answers with recommendations
GET  /api/v1/interview/{session_id}   → read questions + answers from disk
GET  /api/v1/interview/{session_id}/enhanced-spec → input.md + Q&A markdown
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from application.interview_service import InterviewService
from infrastructure.database import HLDSession
from infrastructure.session_storage import SessionStorage, get_storage
from api.deps import get_interview_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interview", tags=["interview"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SolutionOption(BaseModel):
    id: str
    title: str
    description: str
    recommended: bool


class Question(BaseModel):
    id: str
    question: str
    why_critical: str
    context_from_spec: str
    evidence: List[str] = []
    solutions: List[SolutionOption]


class ProgressOut(BaseModel):
    answered: int
    total: int
    completed: bool


class InterviewStartRequest(BaseModel):
    session_id: str


class InterviewStartResponse(BaseModel):
    session_id: str
    questions: List[Question]
    current_question: Question
    progress: ProgressOut


class AnswerRequest(BaseModel):
    session_id: str
    question_id: str
    selected_solution_id: str
    custom_input: str = ""


class AnswerResponse(BaseModel):
    session_id: str
    next_question: Optional[Question]
    progress: ProgressOut
    interview_completed: bool


class SkipQuestionRequest(BaseModel):
    session_id: str
    question_id: str


class SkipAllRequest(BaseModel):
    session_id: str


class InterviewStateResponse(BaseModel):
    session_id: str
    questions: List[Question]
    current_question: Optional[Question]
    progress: ProgressOut
    interview_completed: bool


class EnhancedSpecResponse(BaseModel):
    session_id: str
    enhanced_spec: str
    original_spec: str
    interview_completed: bool


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_answer(question: dict, selected_solution: dict, custom_input: str, skipped: bool) -> dict:
    return {
        "question_id":          question["id"],
        "question_text":        question["question"],
        "selected_solution_id": selected_solution["id"],
        "solution_title":       selected_solution["title"],
        "custom_input":         custom_input,
        "was_skipped":          skipped,
        "answered_at":          datetime.now(timezone.utc).isoformat(),
    }


def _progress(answered: int, total: int, completed: bool) -> ProgressOut:
    return ProgressOut(answered=answered, total=total, completed=completed)


def _next_question(questions: list[dict], answers: list[dict]) -> Optional[Question]:
    idx = len(answers)
    if idx < len(questions):
        return Question(**questions[idx])
    return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/start", response_model=InterviewStartResponse, status_code=status.HTTP_200_OK)
async def start_interview(
    body: InterviewStartRequest,
    interview_svc: InterviewService = Depends(get_interview_service),
    storage: SessionStorage = Depends(get_storage),
) -> InterviewStartResponse:
    session = await HLDSession.get(body.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Idempotency: return cached questions if they already exist
    cached = storage.read_questions(body.session_id)
    if cached:
        logger.info("[Interview] Returning cached questions for session %s", body.session_id)
        answers = storage.read_answers(body.session_id)
        try:
            questions_list = [Question(**q) for q in cached]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Data validation error: {e}",
            )
        current_idx = len(answers)
        current_q   = questions_list[current_idx] if current_idx < len(questions_list) else questions_list[0]
        completed   = len(answers) >= len(questions_list)
        return InterviewStartResponse(
            session_id=body.session_id,
            questions=questions_list,
            current_question=current_q,
            progress=_progress(len(answers), len(questions_list), completed),
        )

    # First time: generate questions via Claude
    spec_text = storage.read_input_md(body.session_id)
    if not spec_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specification file not found for this session",
        )

    char_data = storage.read_characteristics(body.session_id)
    characteristics = char_data.get("characteristics", []) if char_data else []
    logger.info(
        "[Interview] Generating questions for session %s (%d characteristics)",
        body.session_id, len(characteristics),
    )

    raw_questions = await interview_svc.generate_questions(spec_text, characteristics)
    if not raw_questions:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate questions",
        )

    storage.write_questions(body.session_id, raw_questions)
    storage.write_answers(body.session_id, [])

    session.interview_completed = False
    await session.save()

    try:
        questions_list = [Question(**q) for q in raw_questions]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Data validation error: {e}",
        )

    logger.info("[Interview] Generated %d questions for session %s", len(questions_list), body.session_id)

    return InterviewStartResponse(
        session_id=body.session_id,
        questions=questions_list,
        current_question=questions_list[0],
        progress=_progress(0, len(questions_list), False),
    )


@router.post("/answer", response_model=AnswerResponse, status_code=status.HTTP_200_OK)
async def submit_answer(
    body: AnswerRequest,
    storage: SessionStorage = Depends(get_storage),
) -> AnswerResponse:
    session = await HLDSession.get(body.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    questions = storage.read_questions(body.session_id)
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interview not started")

    question_idx = next((i for i, q in enumerate(questions) if q["id"] == body.question_id), None)
    if question_idx is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question not found")

    question = questions[question_idx]

    # Enforce sequential answering: reject future questions that haven't been reached yet
    existing_answers = storage.read_answers(body.session_id)
    answered_ids = {a["question_id"] for a in existing_answers}
    if body.question_id not in answered_ids and question_idx > len(existing_answers):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions must be answered in order",
        )

    solution = next((s for s in question["solutions"] if s["id"] == body.selected_solution_id), None)
    if not solution:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected solution not found")

    answers   = storage.upsert_answer(body.session_id, _build_answer(question, solution, body.custom_input, False))
    completed = len(answers) >= len(questions)

    if completed:
        session.interview_completed = True
        await session.save()

    logger.debug(
        "[Interview] Answer recorded: session=%s question=%s solution=%s",
        body.session_id, body.question_id, body.selected_solution_id,
    )

    return AnswerResponse(
        session_id=body.session_id,
        next_question=_next_question(questions, answers),
        progress=_progress(len(answers), len(questions), completed),
        interview_completed=completed,
    )


@router.post("/skip", response_model=AnswerResponse, status_code=status.HTTP_200_OK)
async def skip_question(
    body: SkipQuestionRequest,
    storage: SessionStorage = Depends(get_storage),
) -> AnswerResponse:
    session = await HLDSession.get(body.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    questions = storage.read_questions(body.session_id)
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interview not started")

    question = next((q for q in questions if q["id"] == body.question_id), None)
    if not question:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question not found")

    recommended = next(
        (s for s in question["solutions"] if s.get("recommended", False)),
        question["solutions"][0] if question["solutions"] else None,
    )
    if not recommended:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No recommended solution found",
        )

    answers   = storage.upsert_answer(body.session_id, _build_answer(question, recommended, "", True))
    completed = len(answers) >= len(questions)

    if completed:
        session.interview_completed = True
        await session.save()

    logger.debug("[Interview] Skipped question %s for session %s", body.question_id, body.session_id)

    return AnswerResponse(
        session_id=body.session_id,
        next_question=_next_question(questions, answers),
        progress=_progress(len(answers), len(questions), completed),
        interview_completed=completed,
    )


@router.post("/skip-all", response_model=AnswerResponse, status_code=status.HTTP_200_OK)
async def skip_all_questions(
    body: SkipAllRequest,
    storage: SessionStorage = Depends(get_storage),
) -> AnswerResponse:
    session = await HLDSession.get(body.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    questions = storage.read_questions(body.session_id)
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interview not started")

    answers      = storage.read_answers(body.session_id)
    answered_ids = {a["question_id"] for a in answers}

    for question in questions:
        if question["id"] not in answered_ids:
            recommended = next(
                (s for s in question["solutions"] if s.get("recommended", False)),
                question["solutions"][0] if question["solutions"] else None,
            )
            if recommended:
                answers.append(_build_answer(question, recommended, "", True))

    storage.write_answers(body.session_id, answers)
    session.interview_completed = True
    await session.save()

    logger.info("[Interview] Skipped all remaining questions for session %s", body.session_id)

    return AnswerResponse(
        session_id=body.session_id,
        next_question=None,
        progress=_progress(len(answers), len(questions), True),
        interview_completed=True,
    )


@router.get("/{session_id}", response_model=InterviewStateResponse)
async def get_interview_state(
    session_id: str,
    storage: SessionStorage = Depends(get_storage),
) -> InterviewStateResponse:
    session = await HLDSession.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    questions = storage.read_questions(session_id)
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interview not started")

    answers        = storage.read_answers(session_id)
    questions_list = [Question(**q) for q in questions]
    completed      = len(answers) >= len(questions)
    current_q      = _next_question(questions, answers)

    return InterviewStateResponse(
        session_id=session_id,
        questions=questions_list,
        current_question=current_q,
        progress=_progress(len(answers), len(questions), completed),
        interview_completed=completed,
    )


@router.get("/{session_id}/enhanced-spec", response_model=EnhancedSpecResponse)
async def get_enhanced_spec(
    session_id: str,
    interview_svc: InterviewService = Depends(get_interview_service),
    storage: SessionStorage = Depends(get_storage),
) -> EnhancedSpecResponse:
    session = await HLDSession.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    original_spec   = storage.read_input_md(session_id)
    questions       = storage.read_questions(session_id)
    answers         = storage.read_answers(session_id)
    char_data       = storage.read_characteristics(session_id)
    characteristics = char_data.get("characteristics", []) if char_data else []

    enhanced_spec = interview_svc.build_enhanced_spec(original_spec, questions, answers, characteristics)

    return EnhancedSpecResponse(
        session_id=session_id,
        enhanced_spec=enhanced_spec,
        original_spec=original_spec,
        interview_completed=session.interview_completed,
    )
