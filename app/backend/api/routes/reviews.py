"""
Review workflow routes — submit HLD for review, manage reviews, comments.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.routes.auth import get_current_user
from infrastructure.database import (
    UserDocument,
    ReviewRequestDocument,
    CommentDocument,
    HLDVersionDocument,
)

router = APIRouter(tags=["reviews"])


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class SubmitReviewRequest(BaseModel):
    session_id: str
    hld_json: str
    reviewer_ids: list[str] = Field(..., min_items=1)
    message: Optional[str] = None


class ReviewSummary(BaseModel):
    id: str
    session_id: str
    author_id: str
    author_name: str
    reviewer_id: str
    reviewer_name: str
    status: str
    submitted_at: str
    reviewed_at: Optional[str] = None
    project_name: Optional[str] = None


class CommentCreate(BaseModel):
    section: str  # "document", "adr_1", "diagram"
    content: str
    parent_id: Optional[str] = None  # For threaded replies


class CommentResponse(BaseModel):
    id: str
    reviewer_id: str
    reviewer_name: str
    section: str
    content: str
    created_at: str
    resolved: bool
    replies: list['CommentResponse'] = []


class ReviewActionRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject|request_changes)$")
    comment: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/reviews/submit")
async def submit_for_review(
    body: SubmitReviewRequest,
    current_user: UserDocument = Depends(get_current_user)
) -> dict:
    """
    Submit HLD for review to selected reviewers.
    Creates review requests for each reviewer.
    Prevents duplicate submissions for same reviewers without HLD changes.
    """
    if current_user.role != "author":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authors can submit HLDs for review"
        )

    # Verify reviewers exist and are actually reviewers
    reviewers = []
    for reviewer_id in body.reviewer_ids:
        reviewer = await UserDocument.find_one(UserDocument.id == reviewer_id)
        if not reviewer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reviewer {reviewer_id} not found"
            )
        if reviewer.role != "reviewer":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {reviewer.name} is not a reviewer"
            )
        reviewers.append(reviewer)

    # Check for duplicate submissions (same session + same reviewers + pending status)
    for reviewer in reviewers:
        existing_pending = await ReviewRequestDocument.find_one(
            ReviewRequestDocument.session_id == body.session_id,
            ReviewRequestDocument.reviewer_id == reviewer.id,
            ReviewRequestDocument.status == "pending"
        )

        if existing_pending:
            # Check if HLD has changed by comparing with existing version
            existing_version = await HLDVersionDocument.find_one(
                HLDVersionDocument.id == existing_pending.version_id
            )
            if existing_version and existing_version.hld_json == body.hld_json:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A pending review already exists for reviewer {reviewer.name} with the same HLD content. Please make changes before resubmitting."
                )

    # Create HLD version
    # Get latest version number for this session
    existing_versions = await HLDVersionDocument.find(
        HLDVersionDocument.session_id == body.session_id
    ).to_list()
    version_number = len(existing_versions) + 1

    version = HLDVersionDocument(
        session_id=body.session_id,
        author_id=current_user.id,
        hld_json=body.hld_json,
        version_number=version_number,
    )
    await version.insert()

    # Create review requests for each reviewer
    review_requests = []
    for reviewer in reviewers:
        review_request = ReviewRequestDocument(
            version_id=version.id,
            session_id=body.session_id,
            author_id=current_user.id,
            reviewer_id=reviewer.id,
            status="pending",
            message=body.message,
        )
        await review_request.insert()
        review_requests.append(review_request)

    return {
        "message": f"HLD submitted to {len(reviewers)} reviewer(s)",
        "version_id": version.id,
        "version_number": version_number,
        "review_request_ids": [r.id for r in review_requests],
    }


@router.get("/reviews/session/{session_id}/versions")
async def get_session_versions(
    session_id: str,
    current_user: UserDocument = Depends(get_current_user)
) -> list[dict]:
    """
    Get all versions of an HLD for a session with their review statuses.
    """
    # Get all versions for this session
    versions = await HLDVersionDocument.find(
        HLDVersionDocument.session_id == session_id
    ).sort("-version_number").to_list()

    if not versions:
        return []

    # Get review status for each version
    version_history = []
    for version in versions:
        # Find all reviews for this version
        reviews = await ReviewRequestDocument.find(
            ReviewRequestDocument.version_id == version.id
        ).to_list()

        # Get reviewer details and status
        review_info = []
        for review in reviews:
            reviewer = await UserDocument.find_one(UserDocument.id == review.reviewer_id)
            review_info.append({
                "review_id": review.id,
                "reviewer_id": review.reviewer_id,
                "reviewer_name": reviewer.name if reviewer else "Unknown",
                "status": review.status,
                "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
                "submitted_at": review.submitted_at.isoformat(),
            })

        # Extract project name
        project_name = "Unknown Project"
        try:
            import json
            hld_data = json.loads(version.hld_json)
            project_name = hld_data.get("project_name", "Unknown Project")
        except:
            pass

        version_history.append({
            "version_id": version.id,
            "version_number": version.version_number,
            "project_name": project_name,
            "created_at": version.created_at.isoformat(),
            "reviews": review_info,
            "hld_json": version.hld_json,
        })

    return version_history


@router.get("/reviews/my-submissions")
async def get_my_submissions(
    current_user: UserDocument = Depends(get_current_user)
) -> list[ReviewSummary]:
    """
    Get all HLDs submitted by the current author.
    Groups by session to show ALL reviews for the LATEST VERSION of each session.
    This ensures authors see all reviewer feedback for their most recent submission.
    """
    if current_user.role != "author":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authors can view submissions"
        )

    reviews = await ReviewRequestDocument.find(
        ReviewRequestDocument.author_id == current_user.id
    ).to_list()

    if not reviews:
        return []

    # Group reviews by session and find the latest version for each session
    session_latest_versions = {}
    for review in reviews:
        version = await HLDVersionDocument.find_one(HLDVersionDocument.id == review.version_id)
        if version:
            session_id = review.session_id
            if session_id not in session_latest_versions or version.version_number > session_latest_versions[session_id]:
                session_latest_versions[session_id] = version.version_number

    # Get all reviews for the latest version of each session
    latest_reviews = []
    for review in reviews:
        version = await HLDVersionDocument.find_one(HLDVersionDocument.id == review.version_id)
        if version and session_latest_versions.get(review.session_id) == version.version_number:
            latest_reviews.append(review)

    # Build response with reviewer details and project names
    summaries = []
    for review in latest_reviews:
        reviewer = await UserDocument.find_one(UserDocument.id == review.reviewer_id)

        # Get project name from HLD version
        version = await HLDVersionDocument.find_one(HLDVersionDocument.id == review.version_id)
        project_name = "Unknown Project"
        if version:
            try:
                import json
                hld_data = json.loads(version.hld_json)
                project_name = hld_data.get("project_name", "Unknown Project")
            except:
                pass

        summaries.append(ReviewSummary(
            id=review.id,
            session_id=review.session_id,
            author_id=review.author_id,
            author_name=current_user.name,
            reviewer_id=review.reviewer_id,
            reviewer_name=reviewer.name if reviewer else "Unknown",
            status=review.status,
            submitted_at=review.submitted_at.isoformat(),
            reviewed_at=review.reviewed_at.isoformat() if review.reviewed_at else None,
            project_name=project_name,
        ))

    return summaries


@router.get("/reviews/status/{session_id}")
async def get_session_review_status(
    session_id: str,
    current_user: UserDocument = Depends(get_current_user)
) -> dict:
    """
    Get review status for a session/HLD.
    Returns aggregate status and list of reviewers for the LATEST VERSION only.
    """
    # Get all versions for this session to find the latest
    all_versions = await HLDVersionDocument.find(
        HLDVersionDocument.session_id == session_id
    ).to_list()

    if not all_versions:
        return {
            "session_id": session_id,
            "has_reviews": False,
            "status": "draft",
            "reviewers": [],
            "version_number": None
        }

    # Find the latest version
    latest_version = max(all_versions, key=lambda v: v.version_number)

    # Get reviews ONLY for the latest version
    reviews = await ReviewRequestDocument.find(
        ReviewRequestDocument.version_id == latest_version.id
    ).to_list()

    if not reviews:
        return {
            "session_id": session_id,
            "has_reviews": False,
            "status": "draft",
            "reviewers": [],
            "version_number": latest_version.version_number
        }

    # Aggregate status logic (now only considers latest version)
    statuses = [r.status for r in reviews]
    if all(s == "approved" for s in statuses):
        overall_status = "approved"
    elif any(s == "rejected" for s in statuses):
        overall_status = "rejected"
    elif any(s == "changes_requested" for s in statuses):
        overall_status = "changes_requested"
    else:
        overall_status = "pending"

    # Get reviewer details
    reviewer_list = []
    for review in reviews:
        reviewer = await UserDocument.find_one(UserDocument.id == review.reviewer_id)
        if reviewer:
            reviewer_list.append({
                "id": reviewer.id,
                "name": reviewer.name,
                "status": review.status,
                "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None
            })

    return {
        "session_id": session_id,
        "has_reviews": True,
        "status": overall_status,
        "reviewers": reviewer_list,
        "submitted_at": reviews[0].submitted_at.isoformat() if reviews else None,
        "version_number": latest_version.version_number
    }


@router.get("/reviews/my-completed")
async def get_my_completed_reviews(
    current_user: UserDocument = Depends(get_current_user)
) -> list[dict]:
    """
    Get all completed reviews for the current reviewer (history).
    """
    if current_user.role != "reviewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers can view review history"
        )

    reviews = await ReviewRequestDocument.find(
        ReviewRequestDocument.reviewer_id == current_user.id,
        ReviewRequestDocument.status != "pending"
    ).to_list()

    summaries = []
    for review in reviews:
        author = await UserDocument.find_one(UserDocument.id == review.author_id)
        version = await HLDVersionDocument.find_one(HLDVersionDocument.id == review.version_id)
        project_name = "Unknown Project"
        version_number = 1
        if version:
            version_number = version.version_number
            try:
                import json
                hld_data = json.loads(version.hld_json)
                project_name = hld_data.get("project_name", "Unknown Project")
            except:
                pass

        summaries.append({
            "id": review.id,
            "session_id": review.session_id,
            "project_name": f"{project_name} (v{version_number})",
            "author_name": author.name if author else "Unknown",
            "status": review.status,
            "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        })

    return summaries


@router.get("/reviews/pending")
async def get_pending_reviews(
    current_user: UserDocument = Depends(get_current_user)
) -> list[ReviewSummary]:
    """
    Get all pending reviews for the current reviewer.
    """
    if current_user.role != "reviewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers can view pending reviews"
        )

    reviews = await ReviewRequestDocument.find(
        ReviewRequestDocument.reviewer_id == current_user.id,
        ReviewRequestDocument.status == "pending"
    ).to_list()

    # Fetch author names and HLD project names with version numbers
    summaries = []
    for review in reviews:
        author = await UserDocument.find_one(UserDocument.id == review.author_id)

        # Get HLD version to extract project name and version number
        version = await HLDVersionDocument.find_one(HLDVersionDocument.id == review.version_id)
        project_name = "Unknown Project"
        version_number = 1
        if version:
            version_number = version.version_number
            try:
                import json
                hld_data = json.loads(version.hld_json)
                project_name = hld_data.get("project_name", "Unknown Project")
            except:
                pass

        summaries.append(ReviewSummary(
            id=review.id,
            session_id=review.session_id,
            author_id=review.author_id,
            author_name=author.name if author else "Unknown",
            reviewer_id=review.reviewer_id,
            reviewer_name=current_user.name,
            status=review.status,
            submitted_at=review.submitted_at.isoformat(),
            reviewed_at=None,
            project_name=f"{project_name} (v{version_number})",
        ))

    return summaries


@router.get("/reviews/session/{session_id}/feedback")
async def get_session_feedback(
    session_id: str,
    version_id: str | None = None,
    current_user: UserDocument = Depends(get_current_user)
) -> dict:
    """
    Get all feedback (comments and review statuses) for a session.
    If version_id is provided, only returns feedback for that specific version.
    """
    # Build query
    query = ReviewRequestDocument.session_id == session_id

    # If version_id specified, filter by it to get ONLY that version's reviews
    if version_id:
        query = query & (ReviewRequestDocument.version_id == version_id)

    # Get reviews
    reviews = await ReviewRequestDocument.find(query).to_list()

    if not reviews:
        return {"comments": [], "reviews": []}

    # Get all comments for these reviews
    all_comments = []
    review_statuses = []

    for review in reviews:
        # Get reviewer info
        reviewer = await UserDocument.find_one(UserDocument.id == review.reviewer_id)

        # Get comments for this review
        comments = await CommentDocument.find(
            CommentDocument.review_request_id == review.id
        ).to_list()

        # Add commenter info to each comment (look up actual commenter, not review's reviewer)
        for comment in comments:
            # Get the actual commenter's name (could be author or reviewer)
            commenter = await UserDocument.find_one(UserDocument.id == comment.reviewer_id)

            all_comments.append({
                "id": comment.id,
                "reviewer_id": comment.reviewer_id,
                "reviewer_name": commenter.name if commenter else "Unknown",
                "section": comment.section,
                "content": comment.content,
                "created_at": comment.created_at.isoformat(),
                "resolved": comment.resolved,
                "review_status": review.status,
            })

        review_statuses.append({
            "review_id": review.id,
            "reviewer_id": review.reviewer_id,
            "reviewer_name": reviewer.name if reviewer else "Unknown",
            "status": review.status,
            "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        })

    return {
        "comments": all_comments,
        "reviews": review_statuses
    }


@router.get("/reviews/{review_id}")
async def get_review(
    review_id: str,
    current_user: UserDocument = Depends(get_current_user)
) -> dict:
    """
    Get full review details including HLD and comments.
    """
    review = await ReviewRequestDocument.find_one(ReviewRequestDocument.id == review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    # Check access permissions
    if review.author_id != current_user.id and review.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get HLD version
    version = await HLDVersionDocument.find_one(HLDVersionDocument.id == review.version_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HLD version not found"
        )

    # Get author and reviewer info
    author = await UserDocument.find_one(UserDocument.id == review.author_id)
    reviewer = await UserDocument.find_one(UserDocument.id == review.reviewer_id)

    # Get comments
    comments = await CommentDocument.find(
        CommentDocument.review_request_id == review_id
    ).to_list()

    # Build comment tree
    comment_map = {}
    root_comments = []

    for comment in comments:
        comment_reviewer = await UserDocument.find_one(UserDocument.id == comment.reviewer_id)
        comment_resp = CommentResponse(
            id=comment.id,
            reviewer_id=comment.reviewer_id,
            reviewer_name=comment_reviewer.name if comment_reviewer else "Unknown",
            section=comment.section,
            content=comment.content,
            created_at=comment.created_at.isoformat(),
            resolved=comment.resolved,
            replies=[]
        )
        comment_map[comment.id] = comment_resp

        if comment.parent_id:
            if comment.parent_id in comment_map:
                comment_map[comment.parent_id].replies.append(comment_resp)
        else:
            root_comments.append(comment_resp)

    return {
        "review": ReviewSummary(
            id=review.id,
            session_id=review.session_id,
            author_id=review.author_id,
            author_name=author.name if author else "Unknown",
            reviewer_id=review.reviewer_id,
            reviewer_name=reviewer.name if reviewer else "Unknown",
            status=review.status,
            submitted_at=review.submitted_at.isoformat(),
            reviewed_at=review.reviewed_at.isoformat() if review.reviewed_at else None,
        ),
        "hld_json": version.hld_json,
        "session_id": review.session_id,
        "comments": root_comments,
    }


@router.post("/reviews/{review_id}/comments")
async def add_comment(
    review_id: str,
    body: CommentCreate,
    current_user: UserDocument = Depends(get_current_user)
) -> CommentResponse:
    """
    Add a comment to a review.
    Both reviewers and authors can add comments.
    """
    review = await ReviewRequestDocument.find_one(ReviewRequestDocument.id == review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    # Check if user is either the reviewer or the author
    if review.reviewer_id != current_user.id and review.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to comment on this review"
        )

    comment = CommentDocument(
        review_request_id=review_id,
        reviewer_id=current_user.id,  # Store commenter's ID (can be author or reviewer)
        section=body.section,
        content=body.content,
        parent_id=body.parent_id,
    )
    await comment.insert()

    return CommentResponse(
        id=comment.id,
        reviewer_id=comment.reviewer_id,
        reviewer_name=current_user.name,
        section=comment.section,
        content=comment.content,
        created_at=comment.created_at.isoformat(),
        resolved=comment.resolved,
        replies=[]
    )


@router.patch("/reviews/{review_id}/action")
async def review_action(
    review_id: str,
    body: ReviewActionRequest,
    current_user: UserDocument = Depends(get_current_user)
) -> dict:
    """
    Approve, reject, or request changes for a review.
    """
    if current_user.role != "reviewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers can perform review actions"
        )

    review = await ReviewRequestDocument.find_one(ReviewRequestDocument.id == review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    if review.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned reviewer"
        )

    # Update review status
    if body.action == "approve":
        review.status = "approved"
    elif body.action == "reject":
        review.status = "rejected"
    elif body.action == "request_changes":
        review.status = "changes_requested"

    review.reviewed_at = datetime.utcnow()
    await review.save()

    # Add final comment if provided
    if body.comment:
        comment = CommentDocument(
            review_request_id=review_id,
            reviewer_id=current_user.id,
            section="final_decision",
            content=body.comment,
        )
        await comment.insert()

    return {
        "message": f"Review {body.action}d successfully",
        "status": review.status
    }


# Enable recursive model for nested replies
CommentResponse.model_rebuild()
