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
from pydantic import BaseModel, Field


class HLDSession(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_name: str
    template: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    interview_completed: bool = False

    class Settings:
        name = "hld_sessions"


class UserDocument(Document):
    """User account for authentication and authorization."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str  # unique, indexed
    password_hash: str
    name: str
    role: str  # "author" | "reviewer"
    avatar_url: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
        indexes = [
            "email",  # Unique index for fast email lookups
        ]


class HLDVersionDocument(Document):
    """Immutable snapshot of an HLD at a point in time."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    author_id: str
    hld_json: str  # Stored as JSON string
    version_number: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "hld_versions"
        indexes = [
            "session_id",
            "author_id",
        ]


class ReviewRequestDocument(Document):
    """Review request - one per reviewer."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version_id: str
    session_id: str
    author_id: str
    reviewer_id: str
    status: str = "pending"  # "pending" | "approved" | "rejected" | "changes_requested"
    message: str | None = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: datetime | None = None

    class Settings:
        name = "review_requests"
        indexes = [
            "version_id",
            "session_id",
            "author_id",
            "reviewer_id",
            "status",
        ]


class CommentDocument(Document):
    """Comment on an HLD review."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    review_request_id: str
    reviewer_id: str
    section: str  # "document", "adr_1", "diagram", "final_decision"
    content: str
    parent_id: str | None = None  # For threaded replies
    resolved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Text anchoring for GitHub-style inline comments
    quoted_text: str | None = None  # The selected text being commented on
    text_start: int | None = None  # Character offset start position
    text_end: int | None = None  # Character offset end position

    class Settings:
        name = "comments"
        indexes = [
            "review_request_id",
            "reviewer_id",
        ]


async def init_db(mongodb_url: str, db_name: str = "vishwakarma") -> None:
    client = AsyncIOMotorClient(mongodb_url)
    await init_beanie(
        database=client[db_name],
        document_models=[
            HLDSession,
            UserDocument,
            ReviewRequestDocument,
            HLDVersionDocument,
            CommentDocument,
        ],
    )
