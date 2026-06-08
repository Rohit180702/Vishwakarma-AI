"""
GET  /api/v1/sessions        → list all past HLD sessions (summary only)
GET  /api/v1/sessions/:id    → load full HLD JSON for a session
POST /api/v1/sessions        → save a newly generated HLD session
POST /api/v1/sessions/upload → upload and parse specification documents
DELETE /api/v1/sessions/:id  → delete a session
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database import HLDSession, UploadedDocument, get_session
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

    class Config:
        from_attributes = True


class SessionDetail(BaseModel):
    id: str
    project_name: str
    template: str
    spec_text: str
    hld_json: str
    created_at: datetime

    class Config:
        from_attributes = True


class SaveSessionRequest(BaseModel):
    project_name: str
    template: str
    spec_text: str
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
async def list_sessions(db: AsyncSession = Depends(get_session)) -> list[SessionSummary]:
    result = await db.execute(
        select(HLDSession).order_by(HLDSession.created_at.desc())
    )
    rows = result.scalars().all()
    return [SessionSummary.model_validate(r) for r in rows]


@router.get("/{session_id}", response_model=SessionDetail, summary="Load a session by ID")
async def get_session_by_id(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> SessionDetail:
    result = await db.execute(
        select(HLDSession).where(HLDSession.id == session_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return SessionDetail.model_validate(row)


@router.post("", response_model=SessionSummary, status_code=status.HTTP_201_CREATED, summary="Save a generated HLD session")
async def save_session(
    body: SaveSessionRequest,
    db: AsyncSession = Depends(get_session),
) -> SessionSummary:
    session = HLDSession(
        id=str(uuid.uuid4()),
        project_name=body.project_name,
        template=body.template,
        spec_text=body.spec_text,
        hld_json=body.hld_json,
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionSummary.model_validate(session)


@router.post("/upload", response_model=UploadSessionResponse, status_code=status.HTTP_201_CREATED, summary="Upload and parse specification documents")
async def upload_documents(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_session),
) -> UploadSessionResponse:
    """
    Upload multiple specification documents, parse them using Docling,
    store them in the database, and return unified context.
    """
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded")

    try:
        # Initialize parser
        parser = DocumentParser()

        # Read and parse files
        file_data = []
        for upload_file in files:
            content = await upload_file.read()
            file_data.append((upload_file.filename or "untitled", content))

        parsed_docs = parser.parse_uploaded_files(file_data)

        # Create unified context
        unified_spec_text = parser.create_unified_context(parsed_docs)

        # Create session
        session_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)

        # Create HLDSession with placeholder values (will be updated during HLD generation)
        hld_session = HLDSession(
            id=session_id,
            project_name="Untitled Project",  # Placeholder, will be updated
            template="",  # Placeholder, will be set during format selection
            spec_text=unified_spec_text,
            hld_json="{}",  # Placeholder, will be filled during HLD generation
            created_at=created_at,
        )
        db.add(hld_session)

        # Store individual documents
        for doc in parsed_docs:
            uploaded_doc = UploadedDocument(
                session_id=session_id,
                filename=doc.filename,
                file_type=doc.file_type,
                size_bytes=doc.size_bytes,
                content=doc.content,
                uploaded_at=created_at,
            )
            db.add(uploaded_doc)

        await db.commit()

        # Prepare response
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
            detail=f"Failed to process documents: {str(e)}"
        )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a session")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> None:
    await db.execute(delete(HLDSession).where(HLDSession.id == session_id))
    await db.commit()
