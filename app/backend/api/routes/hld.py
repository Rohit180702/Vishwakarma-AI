"""
POST /api/v1/hld/generate        → full JSON response
POST /api/v1/hld/generate/stream → SSE stream of tokens
"""
from __future__ import annotations

import json

import re

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from api.deps import get_hld_generation_service
from api.models.requests import GenerateHLDRequest
from api.models.responses import ADRAlternativeOut, ADROut, C4DiagramOut, GenerateHLDResponse, HLDSectionOut, HLDQualityReportOut, QualityCheckOut
from application.hld_generation import HLDGenerationService
from domain.models import HLDTemplate

router = APIRouter(prefix="/hld", tags=["hld"])


@router.post(
    "/generate",
    response_model=GenerateHLDResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a full HLD document (blocking)",
)
async def generate_hld(
    body: GenerateHLDRequest,
    hld_svc: HLDGenerationService = Depends(get_hld_generation_service),
) -> GenerateHLDResponse:
    doc = await hld_svc.generate(
        body.spec_text, HLDTemplate(body.template),
        body.custom_sections, body.custom_template_text,
    )
    return _to_response(doc)


@router.post("/generate/stream", summary="Stream HLD content as server-sent events", response_class=StreamingResponse)
async def stream_hld(
    body: GenerateHLDRequest,
    hld_svc: HLDGenerationService = Depends(get_hld_generation_service),
) -> StreamingResponse:
    token_stream = await hld_svc.stream(
        body.spec_text, HLDTemplate(body.template),
        body.custom_sections, body.custom_template_text,
    )

    async def event_generator():
        # Buffer the full response so we can strip fences and fix JSON
        # before the frontend attempts to parse it.
        accumulated: list[str] = []
        async for token in token_stream:
            accumulated.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"

        # Send a cleaned sentinel that the frontend can use for parsing
        raw = "".join(accumulated)
        cleaned = _strip_fences(raw)
        yield f"data: {json.dumps({'cleaned': cleaned})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Serialisation helper
# ---------------------------------------------------------------------------

def _strip_fences(raw: str) -> str:
    """Remove markdown code fences and extract the outermost JSON object."""
    text = raw.strip()
    # Remove opening fence: ```json or ```
    text = re.sub(r"^```[a-z]*\r?\n?", "", text)
    # Remove closing fence
    text = re.sub(r"\r?\n?```$", "", text)
    text = text.strip()
    # Extract outermost { ... } to handle any remaining preamble/postamble
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text

def _to_response(doc) -> GenerateHLDResponse:
    qr = None
    if doc.quality_report is not None:
        qr = HLDQualityReportOut(
            passed=doc.quality_report.passed,
            score=doc.quality_report.score,
            should_retry=doc.quality_report.should_retry,
            checks=[
                QualityCheckOut(id=c.id, label=c.label, passed=c.passed, message=c.message)
                for c in doc.quality_report.checks
            ],
        )
    return GenerateHLDResponse(
        project_name=doc.project_name,
        template=doc.template.value,
        sections=[
            HLDSectionOut(
                key=s.key,
                number=s.number,
                title=s.title,
                content=s.content,
                reviewer=s.reviewer,
            )
            for s in doc.sections
        ],
        adrs=[
            ADROut(
                id=a.id,
                title=a.title,
                status=a.status,
                context=a.context,
                decision=a.decision,
                alternatives=[
                    ADRAlternativeOut(option=alt.option, pros=alt.pros, cons=alt.cons)
                    for alt in a.alternatives
                ],
                consequences_positive=a.consequences_positive,
                consequences_negative=a.consequences_negative,
                cost_band=a.cost_band,
            )
            for a in doc.adrs
        ],
        diagrams=[
            C4DiagramOut(
                level=d.level.value,
                mermaid_syntax=d.mermaid_syntax,
            )
            for d in doc.diagrams
        ],
        quality_report=qr,
    )
