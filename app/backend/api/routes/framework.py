"""
POST /api/v1/framework/extract-sections
Upload a template document and extract its section headings using LLM.
"""
from __future__ import annotations

import logging

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from api.routes.auth import get_current_user
from application.llm_utils import extract_json
from config import get_settings
from infrastructure.database import UserDocument
from infrastructure.parser import DocumentParser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/framework", tags=["framework"])

_anthropic: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    return _anthropic


class ExtractedSection(BaseModel):
    name: str
    hint: str = ""


class ExtractSectionsResponse(BaseModel):
    sections: list[ExtractedSection]


_EXTRACT_PROMPT = """\
You are analysing an architecture or technical document template.

<document>
{text}
</document>

Your task: extract every top-level section or heading from this document.
For each section return a concise (≤1 sentence) hint describing what content belongs there.

Return ONLY valid JSON — no markdown fences, no explanation:
{{
  "sections": [
    {{ "name": "Section Name", "hint": "What this section should contain." }},
    ...
  ]
}}
"""


@router.post(
    "/extract-sections",
    response_model=ExtractSectionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract section headings from an uploaded template document",
)
async def extract_sections(
    file: UploadFile = File(...),
    current_user: UserDocument = Depends(get_current_user),
) -> ExtractSectionsResponse:
    filename = file.filename or "untitled"
    raw = await file.read()

    try:
        parser = DocumentParser()
        docs = parser.parse_uploaded_files([(filename, raw)])
    except Exception as exc:
        logger.warning("[Framework] Failed to parse uploaded file %s: %s", filename, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read file '{filename}'. Supported formats: PDF, DOCX, Markdown, TXT.",
        ) from exc

    if not docs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File appears to be empty or unreadable.",
        )

    text = docs[0].content[:12_000]  # cap to avoid huge prompts

    try:
        raw_response = await _get_client().messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            timeout=60.0,
            messages=[{"role": "user", "content": _EXTRACT_PROMPT.format(text=text)}],
        )
    except Exception as exc:
        logger.error("[Framework] LLM call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Section extraction failed. Please try again.",
        ) from exc

    raw_text = raw_response.content[0].text if raw_response.content else ""
    json_str = extract_json(raw_text)

    try:
        import json
        data = json.loads(json_str)
        sections = [
            ExtractedSection(name=s["name"], hint=s.get("hint", ""))
            for s in data.get("sections", [])
            if s.get("name")
        ]
    except Exception as exc:
        logger.error("[Framework] Failed to parse LLM response: %s\nRaw: %s", exc, raw_text[:500])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not parse sections from document. Try a different file.",
        ) from exc

    if not sections:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No sections found in the uploaded document.",
        )

    logger.info("[Framework] Extracted %d sections from '%s'", len(sections), filename)
    return ExtractSectionsResponse(sections=sections)
