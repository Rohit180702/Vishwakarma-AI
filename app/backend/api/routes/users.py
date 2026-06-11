"""
User management routes — list users, get user profile.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.routes.auth import get_current_user
from infrastructure.database import UserDocument

router = APIRouter(tags=["users"])


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------

class UserSummary(BaseModel):
    """Public user info (no sensitive data)."""
    id: str
    email: str
    name: str
    role: str
    avatar_url: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserSummary])
async def list_users(
    current_user: UserDocument = Depends(get_current_user)
) -> list[UserSummary]:
    """
    List all users (for reviewer selection).
    Only authenticated users can access this.
    """
    users = await UserDocument.find_all().to_list()

    return [
        UserSummary(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            avatar_url=user.avatar_url,
        )
        for user in users
    ]


@router.get("/users/{user_id}", response_model=UserSummary)
async def get_user(
    user_id: str,
    current_user: UserDocument = Depends(get_current_user)
) -> UserSummary:
    """
    Get a specific user's profile.
    """
    user = await UserDocument.find_one(UserDocument.id == user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserSummary(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        avatar_url=user.avatar_url,
    )
