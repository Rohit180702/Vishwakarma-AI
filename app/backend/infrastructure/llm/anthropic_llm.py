"""
Anthropic Claude implementation of LLMPort.
Prompt text lives in app/backend/prompts/*.md — edit there to tune behaviour.
"""
from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator

import anthropic

from domain.constants import TEMPLATE_META
from domain.models import (
    ADR,
    ADRAlternative,
    C4Boundary,
    C4Diagram,
    C4Node,
    C4NodeType,
    C4Relationship,
    ChatContext,
    ChatMessage,
    DiagramLevel,
    HLDDocument,
    HLDSection,
    HLDTemplate,
    MessageRole,
)
from domain.ports import LLMPort
from domain.quality import HLDQualityValidator
from prompts import prompts

MODEL = "claude-sonnet-4-6"
# Fast model for lightweight structured extraction tasks (diagram query etc.)
FAST_MODEL = "claude-haiku-4-5"

_SPEC_MAX_CHARS = 12_000  # generous limit; CoT needs context to avoid hallucination
_FENCE_RE = re.compile(r"^```[a-z]*\n?(.*?)\n?```$", re.DOTALL)

# Maps each built-in template to its dedicated system prompt file
_TEMPLATE_PROMPT: dict[HLDTemplate, str] = {
    HLDTemplate.ARC42:          "hld/system.arc42",
    HLDTemplate.C4_ADR:         "hld/system.c4-adr",
    HLDTemplate.RFC_DESIGN_DOC: "hld/system.rfc",
}


def _strip_fences(text: str) -> str:
    """Remove markdown code fences that the LLM sometimes wraps JSON in."""
    text = text.strip()
    m = _FENCE_RE.match(text)
    return m.group(1).strip() if m else text


# ---------------------------------------------------------------------------
# Prompt rendering helpers
# ---------------------------------------------------------------------------

_TW_OVERLAY_PROMPT = "hld/thoughtworks-overlay"


def _render_hld_system(
    template: HLDTemplate,
    custom_sections: list[str] | None = None,
    custom_template_text: str | None = None,
    thoughtworks_mode: bool = False,
) -> str:
    overlay = "\n\n" + prompts.render(_TW_OVERLAY_PROMPT) if thoughtworks_mode else ""

    # User uploaded their own template file
    if template == HLDTemplate.CUSTOM and custom_template_text:
        return prompts.render("hld/system.custom-file", template_text=custom_template_text[:6000]) + overlay

    # User customised sections of a built-in template (or full custom section list)
    if template == HLDTemplate.CUSTOM and custom_sections:
        sections_str = "\n".join(
            f"{i + 1}. {title}" for i, title in enumerate(custom_sections)
        )
        return prompts.render("hld/system.custom-sections", sections_str=sections_str) + overlay

    # A built-in template was customised by the user — keep the rich template prompt but
    # override the section list so all quality standards still apply to the user's sections.
    if custom_sections and template in _TEMPLATE_PROMPT:
        base = prompts.render(_TEMPLATE_PROMPT[template])
        sections_str = "\n".join(
            f"{i + 1}. {title}" for i, title in enumerate(custom_sections)
        )
        override = (
            "\n\n## SECTION STRUCTURE OVERRIDE\n\n"
            "Ignore the default section list from the template above. "
            "Generate the HLD using ONLY these sections, in this exact order. "
            "Apply every quality standard, reviewer challenge, specificity rule, and "
            "self-evaluation check from above to each of these sections:\n\n"
            f"{sections_str}\n\n"
            "The `sections` array in your JSON output must contain exactly these sections — "
            "no additions, no renames, no omissions.\n"
        )
        return base + override + overlay

    # Standard built-in template — use dedicated deep prompt
    if template in _TEMPLATE_PROMPT:
        return prompts.render(_TEMPLATE_PROMPT[template]) + overlay

    # Fallback (should not reach here with current enum)
    meta = TEMPLATE_META.get(template, {})
    sections_str = "\n".join(f"  {n}. {t}" for n, t in meta.get("sections", []))
    return prompts.render(
        "hld/system.custom-sections",
        sections_str=sections_str,
    ) + overlay


def _render_hld_user(spec_text: str, correction_hint: str = "") -> str:
    base = prompts.render(
        "hld/user",
        raw_text=spec_text[:_SPEC_MAX_CHARS],
    )
    if correction_hint:
        base += correction_hint
    return base


def _render_chat_system(hld: HLDDocument) -> str:
    # Pass the FULL content of every section so the LLM can make precise edits
    # without inventing or truncating anything. Claude's 200 K context window
    # comfortably fits a full HLD.
    sections_summary = "\n\n".join(
        f"### key=`{s.key}` — Section {s.number}: {s.title}\n\n{s.content}"
        for s in hld.sections
    )
    adrs_summary = "\n".join(
        f"- {a.id}: {a.title} [{a.status}]" for a in hld.adrs
    ) or "none"
    return prompts.render(
        "chat/system",
        project_name=hld.project_name,
        template=hld.template.value,
        sections_summary=sections_summary,
        adrs=adrs_summary,
    )


# ---------------------------------------------------------------------------
# Anthropic adapter
# ---------------------------------------------------------------------------

class AnthropicLLM(LLMPort):
    def __init__(self, api_key: str) -> None:
        # timeout=None disables read/write timeouts for streaming — Anthropic requires
        # streaming for requests that may take longer than 10 minutes, and the default
        # httpx read timeout is too short for a full HLD generation.
        self._client = anthropic.AsyncAnthropic(api_key=api_key, timeout=None)

    async def generate_hld(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        thoughtworks_mode: bool = False,
    ) -> HLDDocument:
        doc = await self._generate_once(
            spec_text, template, custom_sections, custom_template_text,
            thoughtworks_mode=thoughtworks_mode,
        )
        report = HLDQualityValidator().validate(doc)

        # One retry when critical checks fail (missing sections/ADRs/diagrams or thin content)
        if report.should_retry:
            failed = [c for c in report.checks if not c.passed and c.id.startswith("CRIT")]
            correction = (
                "\n\n## CORRECTION REQUIRED\n\n"
                "Your previous response failed the following critical quality checks:\n"
                + "\n".join(f"- [{c.id}] {c.label}: {c.message}" for c in failed)
                + "\n\nRegenerate the complete HLD JSON ensuring every check above passes."
            )
            doc = await self._generate_once(
                spec_text, template, custom_sections, custom_template_text,
                correction_hint=correction, thoughtworks_mode=thoughtworks_mode,
            )
            report = HLDQualityValidator().validate(doc)

        doc.quality_report = report
        return doc

    async def _generate_once(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        correction_hint: str = "",
        thoughtworks_mode: bool = False,
    ) -> HLDDocument:
        system = _render_hld_system(template, custom_sections, custom_template_text, thoughtworks_mode)
        # Use streaming internally so Anthropic never hits its non-streaming timeout limit.
        # We accumulate all chunks and parse at the end — same result, no server-side limit.
        chunks: list[str] = []
        async with self._client.messages.stream(
            model=MODEL,
            max_tokens=32000,
            system=system,
            messages=[
                {"role": "user", "content": _render_hld_user(spec_text, correction_hint)},
            ],
        ) as stream:
            async for text in stream.text_stream:
                chunks.append(text)
        raw = "".join(chunks)
        return _parse_hld_response(raw, template)

    async def stream_hld(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        thoughtworks_mode: bool = False,
    ) -> AsyncIterator[str]:
        system = _render_hld_system(template, custom_sections, custom_template_text, thoughtworks_mode)

        async def _stream() -> AsyncIterator[str]:
            async with self._client.messages.stream(
                model=MODEL,
                max_tokens=32000,
                system=system,
                messages=[
                    {"role": "user", "content": _render_hld_user(spec_text)},
                ],
            ) as stream:
                async for text in stream.text_stream:
                    yield text

        return _stream()

    async def query_diagram(self, question: str, diagram_json: dict) -> dict:
        """
        Given a natural-language question and a C4 diagram JSON, return
        { node_ids: [...], explanation: "..." } identifying the flow.
        """
        system = prompts.render("hld/diagram_query")
        user_content = (
            f"Question: {question}\n\n"
            f"Diagram JSON:\n{json.dumps(diagram_json, indent=2)}"
        )
        response = await self._client.messages.create(
            model=FAST_MODEL,   # Haiku is 5× faster — sufficient for JSON extraction
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = response.content[0].text.strip()
        try:
            return json.loads(_strip_fences(raw))
        except json.JSONDecodeError:
            return {"steps": []}

    async def chat(self, ctx: ChatContext, user_message: ChatMessage) -> ChatMessage:
        messages = [
            {"role": m.role.value, "content": m.content}
            for m in ctx.history
        ] + [{"role": "user", "content": user_message.content}]

        response = await self._client.messages.create(
            model=MODEL,
            max_tokens=8192,
            system=_render_chat_system(ctx.hld),
            messages=messages,
        )
        return ChatMessage(role=MessageRole.ASSISTANT, content=response.content[0].text)

    async def stream_chat(
        self,
        ctx: ChatContext,
        user_message: ChatMessage,
    ) -> AsyncIterator[str]:
        messages = [
            {"role": m.role.value, "content": m.content}
            for m in ctx.history
        ] + [{"role": "user", "content": user_message.content}]

        async with self._client.messages.stream(
            model=MODEL,
            max_tokens=8192,
            system=_render_chat_system(ctx.hld),
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------

def _parse_adr(a: dict) -> ADR:
    """Parse an ADR from the new MADR-format schema."""
    # Parse alternatives (MADR format)
    alternatives = [
        ADRAlternative(
            option=alt.get("option", ""),
            pros=alt.get("pros", []),
            cons=alt.get("cons", []),
        )
        for alt in a.get("alternatives", [])
    ]

    # Handle both new split format and old string format for backwards compatibility
    raw_cons_pos = a.get("consequences_positive", [])
    raw_cons_neg = a.get("consequences_negative", [])

    # Legacy fallback: if old single "consequences" string is present
    if not raw_cons_pos and not raw_cons_neg and "consequences" in a:
        raw_cons_pos = [a["consequences"]]
        raw_cons_neg = []

    return ADR(
        id=a["id"],
        title=a["title"],
        status=a.get("status", "Accepted"),
        context=a.get("context", ""),
        decision=a.get("decision", ""),
        alternatives=alternatives,
        consequences_positive=raw_cons_pos if isinstance(raw_cons_pos, list) else [raw_cons_pos],
        consequences_negative=raw_cons_neg if isinstance(raw_cons_neg, list) else [raw_cons_neg],
        cost_band=a.get("cost_band", "$"),
    )


def _parse_hld_response(raw: str, template: HLDTemplate) -> HLDDocument:
    data = json.loads(_strip_fences(raw))

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

    adrs = [_parse_adr(a) for a in data.get("adrs", [])]

    diagrams = []
    for d in data.get("diagrams", []):
        try:
            level = DiagramLevel(d["level"])
        except (ValueError, KeyError):
            continue  # skip diagrams with unrecognised level

        # Sequence diagrams use Mermaid syntax; all others use structured JSON
        if level == DiagramLevel.SEQUENCE:
            diagrams.append(C4Diagram(
                level=level,
                title=d.get("title", ""),
                mermaid_syntax=d.get("mermaid_syntax", ""),
            ))
            continue

        nodes = []
        for n in d.get("nodes", []):
            try:
                nodes.append(C4Node(
                    id=n["id"],
                    type=C4NodeType(n["type"]),
                    label=n.get("label", n["id"]),
                    description=n.get("description", ""),
                    technology=n.get("technology", ""),
                ))
            except (ValueError, KeyError):
                pass  # skip nodes with invalid type

        relationships = [
            C4Relationship(
                from_id=r["from"],
                to_id=r["to"],
                label=r.get("label", ""),
                technology=r.get("technology", ""),
                async_comm=r.get("async", False),
            )
            for r in d.get("relationships", [])
            if "from" in r and "to" in r
        ]

        boundaries = [
            C4Boundary(
                id=b["id"],
                label=b.get("label", b["id"]),
                node_ids=b.get("node_ids", []),
            )
            for b in d.get("boundaries", [])
            if "id" in b
        ]

        diagrams.append(C4Diagram(
            level=level,
            title=d.get("title", ""),
            nodes=nodes,
            relationships=relationships,
            boundaries=boundaries,
        ))

    return HLDDocument(
        project_name=data.get("project_name", "Untitled Project"),
        template=template,
        sections=sections,
        adrs=adrs,
        diagrams=diagrams,
    )
