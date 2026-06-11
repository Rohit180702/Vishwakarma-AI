"""
Interview service for architectural discovery.
Generates questions, processes answers, and builds enhanced specification.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic
from config import get_settings
from application.llm_utils import extract_json

logger = logging.getLogger(__name__)


class InterviewService:
    """Service for conducting architectural discovery interviews."""

    def __init__(self) -> None:
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

        prompts_dir = Path(__file__).parent.parent / "prompts" / "interview"
        self.system_prompt = (prompts_dir / "system.md").read_text()
        self.questions_prompt_template = (prompts_dir / "generate_questions.md").read_text()

        logger.info("[InterviewService] Initialised with model=%s", self.model)

    # ------------------------------------------------------------------
    # Question generation
    # ------------------------------------------------------------------

    @staticmethod
    def _format_characteristics_context(characteristics: list[dict[str, Any]]) -> str:
        """Render prioritized characteristics as a readable context block for prompt injection."""
        if not characteristics:
            return "(No architecture characteristics detected — treat all areas as open.)"

        sorted_chars = sorted(characteristics, key=lambda c: c.get("priority", 0), reverse=True)
        lines = []
        for c in sorted_chars:
            label       = c.get("label", c.get("id", "unknown"))
            priority    = c.get("priority", "?")
            conf        = c.get("confidence", "?")
            evidence    = c.get("evidence", [])
            evidence_str = "; ".join(evidence[:2]) if evidence else "no direct quote"
            lines.append(f"- **{label}** (priority {priority}/10, confidence {conf}%): {evidence_str}")

        return "\n".join(lines)

    async def generate_questions(
        self,
        spec_text: str,
        characteristics: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Generate the minimum set of architectural questions required for HLD production.

        Characteristics (when provided) are injected as established context so the agent
        does not waste questions on already-known quality attributes and instead focuses
        on gaps that the characteristics highlight.
        """
        characteristics_context = self._format_characteristics_context(characteristics or [])
        prompt = self.questions_prompt_template.format(
            spec_text=spec_text,
            characteristics_context=characteristics_context,
        )

        logger.info(
            "[InterviewService] Generating questions — spec=%d chars, characteristics=%d",
            len(spec_text), len(characteristics or []),
        )

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=64000,
            temperature=0.0,
            system=self.system_prompt,
            messages=[{"role": "user", "content": prompt}],
            timeout=300.0,  # 5 min — Anthropic recommends generous timeouts for long responses
        )

        response_text = response.content[0].text
        logger.debug("[InterviewService] Raw response (%d chars)", len(response_text))

        json_str = extract_json(response_text)

        try:
            questions_data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(
                "[InterviewService] JSON parse error at line %d col %d: %s",
                e.lineno, e.colno, e,
            )
            raise ValueError(f"AI generated invalid JSON: {e}") from e

        questions = questions_data.get("questions", [])
        logger.info("[InterviewService] Generated %d questions", len(questions))
        return questions

    # ------------------------------------------------------------------
    # Spec assembly
    # ------------------------------------------------------------------

    def format_qa_as_markdown(
        self,
        questions: list[dict[str, Any]],
        answers: list[dict[str, Any]],
    ) -> str:
        """Render Q&A pairs as a readable markdown block for HLD generation prompt."""
        if not questions or not answers:
            return ""

        answer_by_qid: dict[str, dict[str, Any]] = {a["question_id"]: a for a in answers}
        lines: list[str] = ["## Architectural Decisions from Interview\n"]

        for i, q in enumerate(questions, 1):
            answer = answer_by_qid.get(q["id"])
            if not answer:
                continue

            was_skipped   = answer.get("was_skipped", False)
            solution_title = answer.get("solution_title", "")
            custom_input   = answer.get("custom_input", "")

            decision_marker = "*(default recommendation)*" if was_skipped else ""
            lines.append(f"\n**Q{i}: {q['question']}**")
            lines.append(f"→ {solution_title} {decision_marker}".strip())

            if custom_input:
                lines.append(f"  *Additional context:* {custom_input}")

            selected_sol = next(
                (s for s in q.get("solutions", []) if s["id"] == answer.get("selected_solution_id")),
                None,
            )
            if selected_sol:
                lines.append(f"  Rationale: {selected_sol.get('description', '')}")

            others = [s["title"] for s in q.get("solutions", []) if s["id"] != answer.get("selected_solution_id")]
            if others:
                lines.append(f"  Alternatives considered: {', '.join(others)}")

        return "\n".join(lines)

    @staticmethod
    def _format_characteristics_markdown(characteristics: list[dict[str, Any]]) -> str:
        """Render characteristics as a ranked markdown table for HLD generation prompt."""
        if not characteristics:
            return ""

        sorted_chars = sorted(characteristics, key=lambda c: c.get("priority", 0), reverse=True)
        lines = [
            "## Architecture Characteristics (User-Prioritized)\n",
            "These quality attributes were detected from the specification and confirmed by the user.",
            "Use them to drive architectural decisions, ADR framing, and trade-off rationale.",
            "Do not re-derive or contradict them without explicit spec evidence.\n",
            "| Characteristic | Priority | Confidence | Key Evidence |",
            "|---------------|----------|------------|--------------|",
        ]
        for c in sorted_chars:
            label       = c.get("label", c.get("id", ""))
            priority    = c.get("priority", "?")
            conf        = f"{c.get('confidence', '?')}%"
            evidence    = c.get("evidence", [])
            evidence_str = evidence[0] if evidence else "—"
            lines.append(f"| {label} | {priority}/10 | {conf} | {evidence_str} |")

        return "\n".join(lines)

    def build_enhanced_spec(
        self,
        original_spec: str,
        questions: list[dict[str, Any]],
        answers: list[dict[str, Any]],
        characteristics: list[dict[str, Any]] | None = None,
    ) -> str:
        """
        Assemble the full enriched specification for HLD generation.

        Sections in order:
          1. Original specification (source of truth)
          2. Architecture characteristics (user-prioritized quality attributes)
          3. Architectural decisions from interview (explicit user choices)
        """
        parts = ["# Original Specification\n", original_spec]

        char_markdown = self._format_characteristics_markdown(characteristics or [])
        if char_markdown:
            parts += ["\n\n", char_markdown]

        qa_markdown = self.format_qa_as_markdown(questions, answers)
        if qa_markdown:
            parts += ["\n\n# Architectural Decisions (from Interview)\n", qa_markdown]

        return "\n".join(parts)

