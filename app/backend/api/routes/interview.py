"""
Interview API endpoints for interactive spec enhancement
POST /api/v1/interview/start          → Start interview session with generated questions
POST /api/v1/interview/answer         → Submit answer to current question
POST /api/v1/interview/skip           → Skip current question (use recommended)
POST /api/v1/interview/skip-all       → Skip all remaining questions (use recommended)
GET  /api/v1/interview/{session_id}   → Get interview state
GET  /api/v1/interview/{session_id}/enhanced-spec → Get enhanced specification
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.interview_service import InterviewService
from infrastructure.database import HLDSession, get_session
from api.deps import get_interview_service

router = APIRouter(prefix="/interview", tags=["interview"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SolutionOption(BaseModel):
    id: str
    title: str
    description: str
    benefits: List[str]
    risks: List[str]
    tradeoffs: List[str]
    recommended: bool


class Question(BaseModel):
    id: str
    question: str
    why_critical: str
    context_from_spec: str
    evidence: List[str] = []
    solutions: List[SolutionOption]


class InterviewStartRequest(BaseModel):
    session_id: str


class InterviewStartResponse(BaseModel):
    session_id: str
    questions: List[Question]
    current_question: Question
    progress: dict


class AnswerRequest(BaseModel):
    session_id: str
    question_id: str
    selected_solution_id: str
    custom_input: str = ""


class AnswerResponse(BaseModel):
    session_id: str
    next_question: Optional[Question]
    progress: dict
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
    progress: dict
    interview_completed: bool


class EnhancedSpecResponse(BaseModel):
    session_id: str
    enhanced_spec: str
    original_spec: str
    interview_completed: bool


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/start", response_model=InterviewStartResponse, status_code=status.HTTP_200_OK)
async def start_interview(
    body: InterviewStartRequest,
    interview_svc: InterviewService = Depends(get_interview_service),
    db: AsyncSession = Depends(get_session),
) -> InterviewStartResponse:
    """
    Start an interview session by generating questions from the specification.
    """
    # Verify session exists
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Generate questions with solution options
    print(f"\n[Interview Route] Generating questions for session {body.session_id}")
    questions = await interview_svc.generate_questions(session.spec_text)

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate questions"
        )

    print(f"[Interview Route] Got {len(questions)} questions")

    # Initialize interview data
    interview_data = {
        "questions": questions,
        "current_question_index": 0,
        "metadata": {
            "total_questions": len(questions),
            "answered": 0,
            "started_at": datetime.now(timezone.utc).isoformat()
        }
    }

    # Store in database
    session.interview_data = json.dumps(interview_data)
    session.interview_completed = False
    await db.commit()

    # Prepare response - validate Pydantic conversion
    print(f"[Interview Route] Converting to Pydantic models...")
    print(f"[Interview Route] Sample question structure:")
    if questions:
        sample_q = questions[0]
        print(f"  Question keys: {list(sample_q.keys())}")
        if 'solutions' in sample_q and sample_q['solutions']:
            print(f"  Solution keys: {list(sample_q['solutions'][0].keys())}")
            print(f"  Full first question: {json.dumps(sample_q, indent=2)[:1000]}")

    try:
        questions_list = [Question(**q) for q in questions]
        print(f"[Interview Route] Successfully converted {len(questions_list)} questions")
    except Exception as e:
        print(f"\n[Interview Route] ❌ ERROR converting to Pydantic: {type(e).__name__}: {e}")
        if questions:
            print(f"[Interview Route] Full problematic question:")
            print(json.dumps(questions[0], indent=2))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Data validation error: {str(e)}"
        )

    current_q = questions_list[0] if questions_list else None

    return InterviewStartResponse(
        session_id=body.session_id,
        questions=questions_list,
        current_question=current_q,
        progress={
            "answered": 0,
            "total": len(questions_list),
            "completed": False
        }
    )


@router.post("/answer", response_model=AnswerResponse, status_code=status.HTTP_200_OK)
async def submit_answer(
    body: AnswerRequest,
    db: AsyncSession = Depends(get_session),
) -> AnswerResponse:
    """
    Submit an answer to the current question.
    """
    # Get session
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not session.interview_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview not started"
        )

    # Parse interview data
    interview_data = json.loads(session.interview_data)
    questions = interview_data["questions"]

    # Find the question
    question_index = next(
        (i for i, q in enumerate(questions) if q["id"] == body.question_id),
        None
    )

    if question_index is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question not found"
        )

    current_question = questions[question_index]

    # Find selected solution
    selected_solution = next(
        (s for s in current_question["solutions"] if s["id"] == body.selected_solution_id),
        None
    )

    if not selected_solution:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected solution not found"
        )

    # Store answer
    current_question["answer"] = {
        "selected_solution_id": body.selected_solution_id,
        "solution_title": selected_solution["title"],
        "custom_input": body.custom_input,
        "was_skipped": False,
        "answered_at": datetime.now(timezone.utc).isoformat()
    }

    # Update metadata
    interview_data["metadata"]["answered"] = sum(1 for q in questions if "answer" in q)
    interview_data["current_question_index"] = question_index + 1

    # Check if interview is complete
    interview_completed = interview_data["metadata"]["answered"] >= interview_data["metadata"]["total_questions"]

    if interview_completed:
        session.interview_completed = True
        interview_data["metadata"]["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Get next question
    next_question = None
    if not interview_completed:
        next_idx = interview_data["current_question_index"]
        if next_idx < len(questions):
            next_question = Question(**questions[next_idx])

    # Save updated interview data
    session.interview_data = json.dumps(interview_data)
    await db.commit()

    return AnswerResponse(
        session_id=body.session_id,
        next_question=next_question,
        progress={
            "answered": interview_data["metadata"]["answered"],
            "total": interview_data["metadata"]["total_questions"],
            "completed": interview_completed
        },
        interview_completed=interview_completed
    )


@router.post("/skip", response_model=AnswerResponse, status_code=status.HTTP_200_OK)
async def skip_question(
    body: SkipQuestionRequest,
    db: AsyncSession = Depends(get_session),
) -> AnswerResponse:
    """
    Skip current question using the recommended solution option.
    """
    # Get session
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not session.interview_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview not started"
        )

    # Parse interview data
    interview_data = json.loads(session.interview_data)
    questions = interview_data["questions"]

    # Find the question
    question_index = next(
        (i for i, q in enumerate(questions) if q["id"] == body.question_id),
        None
    )

    if question_index is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question not found"
        )

    current_question = questions[question_index]

    # Find recommended solution
    recommended_solution = next(
        (s for s in current_question["solutions"] if s.get("recommended", False)),
        current_question["solutions"][0] if current_question["solutions"] else None
    )

    if not recommended_solution:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No recommended solution found"
        )

    # Store skipped answer with recommended solution
    current_question["answer"] = {
        "selected_solution_id": recommended_solution["id"],
        "solution_title": recommended_solution["title"],
        "custom_input": "",
        "was_skipped": True,
        "answered_at": datetime.now(timezone.utc).isoformat()
    }

    # Update metadata
    interview_data["metadata"]["answered"] = sum(1 for q in questions if "answer" in q)
    interview_data["current_question_index"] = question_index + 1

    # Check if interview is complete
    interview_completed = interview_data["metadata"]["answered"] >= interview_data["metadata"]["total_questions"]

    if interview_completed:
        session.interview_completed = True
        interview_data["metadata"]["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Get next question
    next_question = None
    if not interview_completed:
        next_idx = interview_data["current_question_index"]
        if next_idx < len(questions):
            next_question = Question(**questions[next_idx])

    # Save updated interview data
    session.interview_data = json.dumps(interview_data)
    await db.commit()

    return AnswerResponse(
        session_id=body.session_id,
        next_question=next_question,
        progress={
            "answered": interview_data["metadata"]["answered"],
            "total": interview_data["metadata"]["total_questions"],
            "completed": interview_completed
        },
        interview_completed=interview_completed
    )


@router.post("/skip-all", response_model=AnswerResponse, status_code=status.HTTP_200_OK)
async def skip_all_questions(
    body: SkipAllRequest,
    db: AsyncSession = Depends(get_session),
) -> AnswerResponse:
    """
    Skip all remaining questions using recommended solution options.
    """
    # Get session
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not session.interview_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview not started"
        )

    # Parse interview data
    interview_data = json.loads(session.interview_data)
    questions = interview_data["questions"]

    # Skip all unanswered questions
    for question in questions:
        if "answer" not in question:
            # Find recommended solution
            recommended_solution = next(
                (s for s in question["solutions"] if s.get("recommended", False)),
                question["solutions"][0] if question["solutions"] else None
            )

            if recommended_solution:
                question["answer"] = {
                    "selected_solution_id": recommended_solution["id"],
                    "solution_title": recommended_solution["title"],
                    "custom_input": "",
                    "was_skipped": True,
                    "answered_at": datetime.now(timezone.utc).isoformat()
                }

    # Update metadata
    interview_data["metadata"]["answered"] = len(questions)
    interview_data["metadata"]["completed_at"] = datetime.now(timezone.utc).isoformat()
    interview_data["current_question_index"] = len(questions)

    # Mark interview as complete
    session.interview_completed = True
    session.interview_data = json.dumps(interview_data)
    await db.commit()

    return AnswerResponse(
        session_id=body.session_id,
        next_question=None,
        progress={
            "answered": len(questions),
            "total": len(questions),
            "completed": True
        },
        interview_completed=True
    )


@router.get("/{session_id}", response_model=InterviewStateResponse)
async def get_interview_state(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> InterviewStateResponse:
    """
    Get the current state of an interview session.
    """
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not session.interview_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview not started"
        )

    # Parse interview data
    interview_data = json.loads(session.interview_data)
    questions_list = [Question(**q) for q in interview_data["questions"]]

    current_q = None
    current_idx = interview_data.get("current_question_index", 0)
    if current_idx < len(questions_list):
        current_q = questions_list[current_idx]

    answered_count = interview_data["metadata"]["answered"]
    total_questions = interview_data["metadata"]["total_questions"]

    return InterviewStateResponse(
        session_id=session_id,
        questions=questions_list,
        current_question=current_q,
        progress={
            "answered": answered_count,
            "total": total_questions,
            "completed": session.interview_completed
        },
        interview_completed=session.interview_completed
    )


@router.get("/{session_id}/enhanced-spec", response_model=EnhancedSpecResponse)
async def get_enhanced_spec(
    session_id: str,
    interview_svc: InterviewService = Depends(get_interview_service),
    db: AsyncSession = Depends(get_session),
) -> EnhancedSpecResponse:
    """
    Get the enhanced specification combining original spec with interview decisions.
    This is what gets passed to HLD generation.
    """
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not session.interview_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview not started"
        )

    interview_data = json.loads(session.interview_data)
    enhanced_spec = interview_svc.build_enhanced_spec(session.spec_text, interview_data)

    return EnhancedSpecResponse(
        session_id=session_id,
        enhanced_spec=enhanced_spec,
        original_spec=session.spec_text,
        interview_completed=session.interview_completed
    )
