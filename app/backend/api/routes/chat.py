"""
POST /api/v1/hld/chat        → single-turn reply
POST /api/v1/hld/chat/stream → SSE stream
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from api.deps import get_hld_chat_service
from api.models.requests import ChatRequest
from api.models.responses import ChatResponse
from api.routes.auth import get_current_user
from application.hld_chat import HLDChatService
from infrastructure.database import UserDocument
from domain.models import (
    ADR,
    ADRAlternative,
    C4Diagram,
    DiagramLevel,
    HLDDocument,
    HLDSection,
    HLDTemplate,
)

router = APIRouter(prefix="/hld", tags=["chat"])


@router.post("/chat", response_model=ChatResponse, summary="Single-turn HLD chat")
async def chat(
    body: ChatRequest,
    svc: HLDChatService = Depends(get_hld_chat_service),
    current_user: UserDocument = Depends(get_current_user),
) -> ChatResponse:
    hld = _deserialize_hld(body.hld_json)
    reply = await svc.reply(hld, body.history, body.message)
    return ChatResponse(role=reply.role.value, content=reply.content)


@router.post("/chat/stream", summary="Stream HLD chat reply as SSE")
async def stream_chat(
    body: ChatRequest,
    svc: HLDChatService = Depends(get_hld_chat_service),
    current_user: UserDocument = Depends(get_current_user),
) -> StreamingResponse:
    hld = _deserialize_hld(body.hld_json)
    token_stream = await svc.stream_reply(hld, body.history, body.message)

    async def event_generator():
        async for token in token_stream:
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Deserialise HLD from JSON (round-trips with GenerateHLDResponse)
# ---------------------------------------------------------------------------

def _deserialize_hld(data: dict) -> HLDDocument:
    sections = [
        HLDSection(
            key=s["key"],
            number=s["number"],
            title=s["title"],
            content=s["content"],
            reviewer=s.get("reviewer"),
        )
        for s in data.get("sections", [])
    ]

    adrs = [
        ADR(
            id=a["id"],
            title=a["title"],
            status=a["status"],
            context=a["context"],
            decision=a["decision"],
            alternatives=[
                ADRAlternative(
                    option=alt["option"],
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

    diagrams = [
        C4Diagram(
            level=DiagramLevel(d["level"]),
            mermaid_syntax=d.get("mermaid_syntax", ""),
        )
        for d in data.get("diagrams", [])
    ]

    return HLDDocument(
        project_name=data.get("project_name", ""),
        template=HLDTemplate(data.get("template", "arc42")),
        sections=sections,
        adrs=adrs,
        diagrams=diagrams,
    )
