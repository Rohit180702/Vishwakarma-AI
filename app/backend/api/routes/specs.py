"""
POST /api/v1/specs/analyze
Accepts multipart file upload OR raw JSON body with spec_text.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from api.deps import get_spec_analysis_service
from api.models.requests import AnalyzeSpecRequest
from api.models.responses import AnalyzeSpecResponse
from application.spec_analysis import SpecAnalysisService

router = APIRouter(prefix="/specs", tags=["specs"])

_ALLOWED_MIME = {
    "text/plain",
    "text/markdown",
    "application/pdf",          # handled as text extraction stub
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_MAX_BYTES = 500_000  # 500 KB


@router.post(
    "/analyze",
    response_model=AnalyzeSpecResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse a spec document and return a quality score",
)
async def analyze_spec_file(
    file: UploadFile = File(None, description="spec file (.txt .md .docx .pdf)"),
    spec_text: str = Form(None, description="paste raw spec text instead of a file"),
    svc: SpecAnalysisService = Depends(get_spec_analysis_service),
) -> AnalyzeSpecResponse:
    text = await _resolve_text(file, spec_text)
    result = await svc.analyze(text)
    return AnalyzeSpecResponse(
        domain=result.domain,
        project_name=result.project_name,
        overall_score=result.overall_score,
        quality_level=result.quality_level.value,
        dimensions=[
            {"id": d.id, "label": d.label, "score": d.score, "feedback": d.feedback}
            for d in result.dimensions
        ],
        missing_inputs=result.missing_inputs,
    )


@router.post(
    "/analyze/json",
    response_model=AnalyzeSpecResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse a spec passed as JSON body",
)
async def analyze_spec_json(
    body: AnalyzeSpecRequest,
    svc: SpecAnalysisService = Depends(get_spec_analysis_service),
) -> AnalyzeSpecResponse:
    result = await svc.analyze(body.spec_text)
    return AnalyzeSpecResponse(
        domain=result.domain,
        project_name=result.project_name,
        overall_score=result.overall_score,
        quality_level=result.quality_level.value,
        dimensions=[
            {"id": d.id, "label": d.label, "score": d.score, "feedback": d.feedback}
            for d in result.dimensions
        ],
        missing_inputs=result.missing_inputs,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _resolve_text(
    file: UploadFile | None,
    spec_text: str | None,
) -> str:
    if file is not None:
        if file.content_type not in _ALLOWED_MIME and not file.filename.endswith(
            (".txt", ".md", ".docx", ".pdf")
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {file.content_type}",
            )
        raw = await file.read()
        if len(raw) > _MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File exceeds {_MAX_BYTES // 1000} KB limit",
            )
        return raw.decode("utf-8", errors="replace")

    if spec_text:
        return spec_text

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide either a file or spec_text",
    )
