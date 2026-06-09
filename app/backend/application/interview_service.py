"""
Interview service for architectural discovery.
Generates questions, processes answers, and builds enhanced specification.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic
from config import get_settings


class InterviewService:
    """Service for conducting architectural discovery interviews."""

    def __init__(self, llm=None) -> None:
        # We receive llm for consistency but don't use it - we need direct Anthropic access
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

        # Load prompts
        prompts_dir = Path(__file__).parent.parent / "prompts" / "interview"
        self.system_prompt = (prompts_dir / "system.md").read_text()
        self.questions_prompt_template = (prompts_dir / "generate_questions.md").read_text()

    async def generate_questions(self, spec_text: str) -> list[dict[str, Any]]:
        """
        Generate dynamic set of architectural questions from specification.

        Uses AI to analyze spec gaps and generate only the questions needed
        for HLD creation. Question count varies from 0-20 based on spec quality.

        Args:
            spec_text: The unified specification text

        Returns:
            List of question objects with solutions (dynamic count 0-20)
        """
        prompt = self.questions_prompt_template.format(spec_text=spec_text)

        print(f"\n[InterviewService] Calling Claude API with {len(prompt)} char prompt...")
        print(f"[InterviewService] Model: {self.model}")

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=8000,
            temperature=0.0,
            system=self.system_prompt,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        response_text = response.content[0].text
        print(f"\n[InterviewService] Raw AI Response ({len(response_text)} chars):")
        print(f"{response_text[:500]}...")

        # Extract JSON
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
        else:
            json_str = response_text.strip()

        print(f"\n[InterviewService] Extracted JSON ({len(json_str)} chars):")
        print(f"{json_str[:500]}...")

        try:
            questions_data = json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"\n[InterviewService] ❌ JSON PARSE ERROR: {str(e)}")
            print(f"[InterviewService] Error at line {e.lineno}, column {e.colno}")
            print(f"\n[InterviewService] Full problematic JSON:\n{json_str}")
            raise ValueError(f"AI generated invalid JSON: {str(e)}")

        questions = questions_data.get("questions", [])

        print(f"\n[InterviewService] Parsed {len(questions)} questions")
        if questions:
            print(f"[InterviewService] First question keys: {list(questions[0].keys())}")
            if questions[0].get('solutions'):
                print(f"[InterviewService] First solution keys: {list(questions[0]['solutions'][0].keys())}")

        # Dynamic question count - no hardcoded limits
        # AI determines count based on spec gaps (0-20 guideline)
        print(f"[InterviewService] Dynamic count: {len(questions)} questions generated")

        return questions

    def format_qa_as_markdown(
        self,
        questions: list[dict[str, Any]],
        answers: list[dict[str, Any]],
    ) -> str:
        """
        Render the separated questions + answers lists into a readable markdown block
        for inclusion in the HLD generation prompt.

        questions: list from questions.json (full question objects, no embedded answers)
        answers:   list from answers.json   (one record per answered question)
        """
        if not questions or not answers:
            return ""

        # Index answers by question_id for O(1) lookup
        answer_by_qid: dict[str, dict[str, Any]] = {a["question_id"]: a for a in answers}

        lines: list[str] = ["## Architectural Decisions from Interview\n"]

        for i, q in enumerate(questions, 1):
            answer = answer_by_qid.get(q["id"])
            if not answer:
                continue  # unanswered question — skip

            was_skipped = answer.get("was_skipped", False)
            solution_title = answer.get("solution_title", "")
            custom_input = answer.get("custom_input", "")

            decision_marker = "*(default recommendation)*" if was_skipped else ""
            lines.append(f"\n**Q{i}: {q['question']}**")
            lines.append(f"→ {solution_title} {decision_marker}".strip())

            if custom_input:
                lines.append(f"  *Additional context:* {custom_input}")

            # Pull description from the matching solution object
            selected_sol = next(
                (s for s in q.get("solutions", []) if s["id"] == answer.get("selected_solution_id")),
                None,
            )
            if selected_sol:
                lines.append(f"  Rationale: {selected_sol.get('description', '')}")

            # Alternatives considered
            others = [s["title"] for s in q.get("solutions", []) if s["id"] != answer.get("selected_solution_id")]
            if others:
                lines.append(f"  Alternatives considered: {', '.join(others)}")

        return "\n".join(lines)

    def build_enhanced_spec(
        self,
        original_spec: str,
        questions: list[dict[str, Any]],
        answers: list[dict[str, Any]],
    ) -> str:
        """
        Combine the original specification with the interview Q&A for HLD generation.

        original_spec: contents of input.md
        questions:     list from questions.json
        answers:       list from answers.json
        """
        qa_markdown = self.format_qa_as_markdown(questions, answers)

        parts = ["# Original Specification\n", original_spec]
        if qa_markdown:
            parts += ["\n\n# Architectural Decisions (from Interview)\n", qa_markdown]

        return "\n".join(parts)
