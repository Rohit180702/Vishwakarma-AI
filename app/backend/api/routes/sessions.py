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

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional as Opt

from infrastructure.database import HLDSession, UserDocument
from infrastructure.auth import decode_access_token
from infrastructure.session_storage import get_storage
from infrastructure.parser import DocumentParser

router = APIRouter(prefix="/sessions", tags=["sessions"])
_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: Opt[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Opt[UserDocument]:
    """Return the current user if a valid Bearer token is provided, else None."""
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return await UserDocument.find_one(UserDocument.id == user_id)


def _check_session_access(session: HLDSession, current_user: Opt[UserDocument]) -> None:
    """
    Raise 403 unless the requester owns the session.

    Sessions created without a logged-in user have author_id=None and remain
    accessible to anyone, matching the anonymous-upload flow.
    """
    if session.author_id is None:
        return
    if not current_user or current_user.id != session.author_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this session")


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
    has_characteristics: bool = False  # true once characteristics detection has run


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
    project_name: str
    documents: List[UploadedDocumentInfo]
    unified_spec_text: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SessionSummary], summary="List all past sessions")
async def list_sessions(current_user: Opt[UserDocument] = Depends(get_optional_user)) -> list[SessionSummary]:
    query = HLDSession.find(HLDSession.author_id == current_user.id) if current_user else HLDSession.find()
    sessions = await query.sort(-HLDSession.created_at).to_list()
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
        char_data = store.read_characteristics(s.id)
        has_characteristics = bool(char_data and char_data.get("characteristics"))
        if has_hld:
            stage = "generate"
        elif has_interview:
            stage = "format"
        elif has_characteristics:
            stage = "interview"
        else:
            stage = "characteristics"
        result.append(SessionSummary(
            id=s.id,
            project_name=s.project_name,
            template=s.template,
            created_at=s.created_at,
            stage=stage,
        ))
    return result


@router.get("/{session_id}", response_model=SessionDetail, summary="Load a session by ID")
async def get_session_by_id(
    session_id: str,
    current_user: Opt[UserDocument] = Depends(get_optional_user),
) -> SessionDetail:
    session = await HLDSession.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    _check_session_access(session, current_user)

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

    char_data = store.read_characteristics(session_id)
    has_characteristics = bool(char_data and char_data.get("characteristics"))

    return SessionDetail(
        id=session.id,
        project_name=session.project_name,
        template=session.template,
        spec_text=store.read_input_md(session_id),
        hld_json=store.read_hld(session_id),
        created_at=session.created_at,
        qa_pairs=qa_pairs,
        has_characteristics=has_characteristics,
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
        stage="generate",
    )


@router.post(
    "/upload",
    response_model=UploadSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse specification documents",
)
async def upload_documents(
    files: List[UploadFile] = File(...),
    current_user: Opt[UserDocument] = Depends(get_optional_user),
) -> UploadSessionResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded")

    try:
        parser = DocumentParser()

        file_data = [(f.filename or "untitled", await f.read()) for f in files]
        parsed_docs = parser.parse_uploaded_files(file_data)
        unified_spec_text = parser.create_unified_context(parsed_docs)

        session_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)

        # Auto-number per author: "Project - 1", "Project - 2", …
        if current_user:
            project_count = await HLDSession.find(HLDSession.author_id == current_user.id).count()
        else:
            project_count = await HLDSession.count()
        project_name = f"Project - {project_count + 1}"

        # Persist metadata in MongoDB
        hld_session = HLDSession(
            id=session_id,
            project_name=project_name,
            template="",
            created_at=created_at,
            author_id=current_user.id if current_user else None,
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
            project_name=project_name,
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
async def delete_session(
    session_id: str,
    current_user: Opt[UserDocument] = Depends(get_optional_user),
) -> None:
    session = await HLDSession.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    _check_session_access(session, current_user)
    await session.delete()
    get_storage().delete_session(session_id)


@router.delete("/{session_id}/hld", status_code=status.HTTP_204_NO_CONTENT, summary="Clear generated HLD for a session")
async def delete_session_hld(
    session_id: str,
    current_user: Opt[UserDocument] = Depends(get_optional_user),
) -> None:
    session = await HLDSession.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    _check_session_access(session, current_user)
    get_storage().delete_hld(session_id)
