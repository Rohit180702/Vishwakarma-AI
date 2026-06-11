"""
POST /api/v1/hld/generate        → full JSON response
POST /api/v1/hld/generate/stream → SSE stream of tokens
POST /api/v1/hld/diagram/query   → conversational diagram flow query
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, status

logger = logging.getLogger(__name__)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.deps import get_hld_generation_service, get_llm
from api.models.requests import GenerateHLDRequest
from infrastructure.llm.anthropic_llm import AnthropicLLM
from api.models.responses import (
    ADRAlternativeOut, ADROut,
    C4DiagramOut, C4NodeOut, C4RelationshipOut, C4BoundaryOut,
    GenerateHLDResponse,
    HLDSectionOut, HLDQualityReportOut, QualityCheckOut,
    StrictCheckOut, StrictQualityReportOut,
)
from application.hld_generation import HLDGenerationService
from domain.models import (
    ADR, ADRAlternative,
    C4Boundary, C4Diagram, C4Node, C4NodeType, C4Relationship,
    DiagramLevel, HLDDocument, HLDSection, HLDTemplate,
)
from domain.quality_strict import HLDStrictValidator

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
    logger.info("[hld] generate — template=%s spec=%d chars", body.template, len(body.spec_text))
    doc = await hld_svc.generate(
        body.spec_text, HLDTemplate(body.template),
        body.custom_sections, body.custom_template_text,
        body.thoughtworks_mode,
    )
    logger.info("[hld] generate complete — sections=%d adrs=%d diagrams=%d",
                len(doc.sections), len(doc.adrs), len(doc.diagrams))
    return _to_response(doc)


@router.post("/generate/stream", summary="Stream HLD content as server-sent events", response_class=StreamingResponse)
async def stream_hld(
    body: GenerateHLDRequest,
    hld_svc: HLDGenerationService = Depends(get_hld_generation_service),
) -> StreamingResponse:
    token_stream = await hld_svc.stream(
        body.spec_text, HLDTemplate(body.template),
        body.custom_sections, body.custom_template_text,
        body.thoughtworks_mode,
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
# Strict quality evaluation endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/evaluate/doc",
    response_model=StrictQualityReportOut,
    status_code=status.HTTP_200_OK,
    summary="Run strict quality evaluation on a raw HLD JSON document",
)
async def evaluate_hld_doc(body: dict) -> StrictQualityReportOut:
    """
    Accepts the raw JSON output of /generate and returns a detailed strict
    quality report without calling the LLM.
    """
    doc = _parse_hld_from_dict(body)
    report = HLDStrictValidator().validate(doc)
    return StrictQualityReportOut(
        template=report.template,
        passed=report.passed,
        score=report.score,
        structural_score=report.structural_score,
        semantic_score=report.semantic_score,
        checks=[
            StrictCheckOut(
                id=c.id,
                label=c.label,
                passed=c.passed,
                message=c.message,
                tier=c.tier,
                template_specific=c.template_specific,
            )
            for c in report.checks
        ],
    )


def _parse_hld_from_dict(data: dict) -> HLDDocument:
    """Reconstruct a domain HLDDocument from the raw /generate JSON response."""
    sections = [
        HLDSection(
            key=s.get("key", ""),
            number=s.get("number", ""),
            title=s.get("title", ""),
            content=s.get("content", ""),
            reviewer=s.get("reviewer"),
        )
        for s in data.get("sections", [])
    ]
    adrs = [
        ADR(
            id=a.get("id", ""),
            title=a.get("title", ""),
            status=a.get("status", ""),
            context=a.get("context", ""),
            decision=a.get("decision", ""),
            alternatives=[
                ADRAlternative(
                    option=alt.get("option", ""),
                    pros=alt.get("pros", []),
                    cons=alt.get("cons", []),
                )
                for alt in a.get("alternatives", [])
            ],
            consequences_positive=a.get("consequences_positive", []),
            consequences_negative=a.get("consequences_negative", []),
            cost_band=a.get("cost_band", "$"),
        )
        for a in data.get("adrs", [])
    ]
    diagrams = []
    for d in data.get("diagrams", []):
        try:
            nodes = [
                C4Node(
                    id=n.get("id", ""),
                    type=C4NodeType(n.get("type", "system")),
                    label=n.get("label", ""),
                    description=n.get("description", ""),
                    technology=n.get("technology", ""),
                )
                for n in d.get("nodes", [])
                if n.get("id")
            ]
            relationships = [
                C4Relationship(
                    from_id=r.get("from_id", ""),
                    to_id=r.get("to_id", ""),
                    label=r.get("label", ""),
                    technology=r.get("technology", ""),
                    async_comm=r.get("async_comm", False),
                )
                for r in d.get("relationships", [])
            ]
            boundaries = [
                C4Boundary(
                    id=b.get("id", ""),
                    label=b.get("label", ""),
                    node_ids=b.get("node_ids", []),
                )
                for b in d.get("boundaries", [])
            ]
            diagrams.append(C4Diagram(
                level=DiagramLevel(d.get("level", "context")),
                title=d.get("title", ""),
                nodes=nodes,
                relationships=relationships,
                boundaries=boundaries,
                mermaid_syntax=d.get("mermaid_syntax", ""),
            ))
        except ValueError:
            pass
    return HLDDocument(
        project_name=data.get("project_name", ""),
        template=HLDTemplate(data.get("template", "arc42")),
        sections=sections,
        adrs=adrs,
        diagrams=diagrams,
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
                title=d.title,
                nodes=[
                    C4NodeOut(id=n.id, type=n.type.value, label=n.label,
                              description=n.description, technology=n.technology)
                    for n in d.nodes
                ],
                relationships=[
                    C4RelationshipOut(from_id=r.from_id, to_id=r.to_id,
                                      label=r.label, technology=r.technology,
                                      async_comm=r.async_comm)
                    for r in d.relationships
                ],
                boundaries=[
                    C4BoundaryOut(id=b.id, label=b.label, node_ids=b.node_ids)
                    for b in d.boundaries
                ],
                mermaid_syntax=d.mermaid_syntax,
            )
            for d in doc.diagrams
        ],
        quality_report=qr,
    )


# ---------------------------------------------------------------------------
# Diagram conversational query
# ---------------------------------------------------------------------------

class DiagramQueryRequest(BaseModel):
    question: str
    diagram: dict[str, Any]


class DiagramStep(BaseModel):
    node_id: str
    explanation: str


class DiagramQueryResponse(BaseModel):
    steps: list[DiagramStep]


@router.post(
    "/diagram/query",
    response_model=DiagramQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask a natural-language question about a C4 diagram; returns an ordered step-by-step flow walkthrough",
)
async def query_diagram(
    body: DiagramQueryRequest,
    llm: AnthropicLLM = Depends(get_llm),
) -> DiagramQueryResponse:
    result = await llm.query_diagram(body.question, body.diagram)
    raw_steps = result.get("steps", [])
    return DiagramQueryResponse(
        steps=[
            DiagramStep(node_id=s.get("node_id", ""), explanation=s.get("explanation", ""))
            for s in raw_steps
            if s.get("node_id")
        ]
    )
