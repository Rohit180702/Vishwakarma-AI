"""
MongoDB database setup using Motor (async driver) and Beanie ODM.

HLDSession stores only session metadata; all heavy content lives on disk:
  data/sessions/{id}/input.md        ← specification
  data/sessions/{id}/questions.json  ← interview questions
  data/sessions/{id}/answers.json    ← user decisions
  data/sessions/{id}/hld.json        ← generated HLD
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import Field


class HLDSession(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_name: str
    template: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    interview_completed: bool = False

    class Settings:
        name = "hld_sessions"


async def init_db(mongodb_url: str, db_name: str = "vishwakarma") -> None:
    client = AsyncIOMotorClient(mongodb_url)
    await init_beanie(
        database=client[db_name],
        document_models=[HLDSession],
    )
