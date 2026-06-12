"""
Authentication routes — login, register, logout, get current user.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from infrastructure.auth import (
    create_access_token,
    hash_password,
    verify_password,
    decode_access_token,
)
from infrastructure.database import UserDocument

router = APIRouter(tags=["auth"])
security = HTTPBearer()


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)
    role: str = Field(..., pattern="^(author|reviewer)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar_url: str | None = None
    created_at: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------------------------
# Dependency: Get current user from JWT
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserDocument:
    """
    Verify JWT token and return current user.
    Raises 401 if token is invalid or user not found.
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await UserDocument.find_one(UserDocument.id == user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


# Optional: role-based dependency
def require_role(required_role: str):
    """Dependency factory to require a specific role."""
    async def role_checker(user: UserDocument = Depends(get_current_user)) -> UserDocument:
        if user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. {required_role.capitalize()} role required.",
            )
        return user
    return role_checker


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/auth/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> LoginResponse:
    """
    Register a new user account.
    Returns access token and user info.
    """
    # Check if email already exists
    existing = await UserDocument.find_one(UserDocument.email == body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    user = UserDocument(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
        role=body.role,
    )
    await user.insert()

    # Generate access token
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role, "email": user.email}
    )

    return LoginResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            avatar_url=user.avatar_url,
            created_at=user.created_at.isoformat(),
        ),
    )


@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """
    Login with email and password.
    Returns access token and user info.
    """
    # Find user by email
    user = await UserDocument.find_one(UserDocument.email == body.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with this email. Please sign up first.",
        )

    # Verify password
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
        )

    # Generate access token
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role, "email": user.email}
    )

    return LoginResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            avatar_url=user.avatar_url,
            created_at=user.created_at.isoformat(),
        ),
    )


@router.post("/auth/logout")
async def logout(user: UserDocument = Depends(get_current_user)) -> dict:
    """
    Logout (client should discard token).
    Server-side is stateless, so this is mainly a placeholder.
    """
    return {"message": "Successfully logged out"}


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: UserDocument = Depends(get_current_user)) -> UserResponse:
    """
    Get current authenticated user info.
    """
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat(),
    )
