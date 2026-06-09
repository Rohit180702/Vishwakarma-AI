"""
GET    /api/v1/sessions        → list all past HLD sessions (metadata only)
GET    /api/v1/sessions/:id    → load session metadata + file content
POST   /api/v1/sessions        → save (upsert) a generated HLD session
POST   /api/v1/sessions/upload → upload and parse specification documents
DELETE /api/v1/sessions/:id    → delete a session (DB + disk)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, status
from pydantic import BaseModel

from infrastructure.database import HLDSession
from infrastructure.session_storage import get_storage
from infrastructure.parser import DocumentParser

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SessionSummary(BaseModel):
    id: str
    project_name: str
    template: str
    created_at: datetime
    stage: str  # "interview" | "format" | "generate"


class QAPair(BaseModel):
    question: str
    decision: str
    was_skipped: bool
    custom_input: str


class SessionDetail(BaseModel):
    id: str
    project_name: str
    template: str
    spec_text: str    # contents of input.md
    hld_json: str     # contents of hld.json
    created_at: datetime
    qa_pairs: list[QAPair] = []


class SaveSessionRequest(BaseModel):
    """
    session_id: supply the ID that was returned by /sessions/upload so the
    same record is updated instead of creating a duplicate.  If omitted a new
    session is created (backward-compat path).
    """
    session_id: Optional[str] = None
    project_name: str
    template: str
    spec_text: str   # kept in request for backward compat; ignored when session_id is supplied
    hld_json: str


class UploadedDocumentInfo(BaseModel):
    filename: str
    file_type: str
    size_bytes: int
    content_preview: str


class UploadSessionResponse(BaseModel):
    session_id: str
    documents: List[UploadedDocumentInfo]
    unified_spec_text: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SessionSummary], summary="List all past sessions")
async def list_sessions() -> list[SessionSummary]:
    sessions = await HLDSession.find().sort(-HLDSession.created_at).to_list()
    store = get_storage()
    result = []
    for s in sessions:
        hld = store.read_hld(s.id)
        try:
            import json as _json
            parsed = _json.loads(hld)
            has_hld = bool(parsed.get("sections"))
        except Exception:
            has_hld = False
        has_interview = bool(store.read_answers(s.id))
        if has_hld:
            stage = "generate"
        elif has_interview:
            stage = "format"
        else:
            stage = "interview"
        result.append(SessionSummary(
            id=s.id,
            project_name=s.project_name,
            template=s.template,
            created_at=s.created_at,
            stage=stage,
        ))
    return result


@router.get("/{session_id}", response_model=SessionDetail, summary="Load a session by ID")
async def get_session_by_id(session_id: str) -> SessionDetail:
    session = await HLDSession.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    store = get_storage()

    # Join questions + answers into simple pairs for the UI
    questions = store.read_questions(session_id)
    answers = store.read_answers(session_id)
    answer_by_qid = {a["question_id"]: a for a in answers}
    qa_pairs = [
        QAPair(
            question=q["question"],
            decision=answer_by_qid[q["id"]]["solution_title"] if q["id"] in answer_by_qid else "",
            was_skipped=answer_by_qid[q["id"]].get("was_skipped", False) if q["id"] in answer_by_qid else False,
            custom_input=answer_by_qid[q["id"]].get("custom_input", "") if q["id"] in answer_by_qid else "",
        )
        for q in questions
    ]

    return SessionDetail(
        id=session.id,
        project_name=session.project_name,
        template=session.template,
        spec_text=store.read_input_md(session_id),
        hld_json=store.read_hld(session_id),
        created_at=session.created_at,
        qa_pairs=qa_pairs,
    )


@router.post(
    "",
    response_model=SessionSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Save (upsert) a generated HLD session",
)
async def save_session(body: SaveSessionRequest) -> SessionSummary:
    store = get_storage()

    if body.session_id:
        # Update the session that was created during upload
        session = await HLDSession.get(body.session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        session.project_name = body.project_name
        session.template = body.template
        await session.save()
    else:
        # No session_id supplied — create a fresh record and write spec to disk
        session = HLDSession(
            project_name=body.project_name,
            template=body.template,
        )
        await session.insert()
        store.write_input_md(session.id, body.spec_text)

    store.write_hld(session.id, body.hld_json)

    return SessionSummary(
        id=session.id,
        project_name=session.project_name,
        template=session.template,
        created_at=session.created_at,
    )


@router.post(
    "/upload",
    response_model=UploadSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse specification documents",
)
async def upload_documents(files: List[UploadFile] = File(...)) -> UploadSessionResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded")

    try:
        parser = DocumentParser()

        file_data = [(f.filename or "untitled", await f.read()) for f in files]
        parsed_docs = parser.parse_uploaded_files(file_data)
        unified_spec_text = parser.create_unified_context(parsed_docs)

        session_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)

        # Persist metadata in MongoDB
        hld_session = HLDSession(
            id=session_id,
            project_name="Untitled Project",
            template="",
            created_at=created_at,
        )
        await hld_session.insert()

        # Write unified spec to disk
        get_storage().write_input_md(session_id, unified_spec_text)

        doc_infos = [
            UploadedDocumentInfo(
                filename=doc.filename,
                file_type=doc.file_type,
                size_bytes=doc.size_bytes,
                content_preview=doc.get_preview(),
            )
            for doc in parsed_docs
        ]

        return UploadSessionResponse(
            session_id=session_id,
            documents=doc_infos,
            unified_spec_text=unified_spec_text,
            created_at=created_at,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process documents: {str(e)}",
        )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a session")
async def delete_session(session_id: str) -> None:
    session = await HLDSession.get(session_id)
    if session:
        await session.delete()
    get_storage().delete_session(session_id)
