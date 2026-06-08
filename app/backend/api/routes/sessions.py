"""
GET  /api/v1/sessions        → list all past HLD sessions (summary only)
GET  /api/v1/sessions/:id    → load full HLD JSON for a session
POST /api/v1/sessions        → save a newly generated HLD session
DELETE /api/v1/sessions/:id  → delete a session
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database import HLDSession, get_session

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


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a session")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> None:
    await db.execute(delete(HLDSession).where(HLDSession.id == session_id))
    await db.commit()
