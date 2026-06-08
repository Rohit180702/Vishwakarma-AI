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
        Generate 6 critical architectural questions from specification.

        Args:
            spec_text: The unified specification text

        Returns:
            List of question objects with solutions
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

        questions_data = json.loads(json_str)
        questions = questions_data.get("questions", [])

        print(f"\n[InterviewService] Parsed {len(questions)} questions")
        if questions:
            print(f"[InterviewService] First question keys: {list(questions[0].keys())}")
            if questions[0].get('solutions'):
                print(f"[InterviewService] First solution keys: {list(questions[0]['solutions'][0].keys())}")

        # Ensure exactly 6 questions
        if len(questions) > 6:
            questions = questions[:6]
            print(f"[InterviewService] Trimmed to 6 questions")

        return questions

    def export_to_markdown(self, interview_data: dict[str, Any]) -> str:
        """
        Convert interview data to markdown format for HLD generation.

        Args:
            interview_data: The interview data from database

        Returns:
            Markdown formatted interview results
        """
        if not interview_data or "questions" not in interview_data:
            return ""

        sections = ["# Architectural Interview Results\n"]
        sections.append(f"**Interview Date:** {interview_data.get('metadata', {}).get('completed_at', 'N/A')}\n")
        sections.append(f"**Questions Answered:** {interview_data.get('metadata', {}).get('answered', 0)}/{interview_data.get('metadata', {}).get('total_questions', 0)}\n")
        sections.append("\n---\n")

        for i, q_data in enumerate(interview_data.get("questions", []), 1):
            sections.append(f"\n## Question {i}: {q_data['question']}\n")
            sections.append(f"**Why Critical:** {q_data['why_critical']}\n")
            sections.append(f"**Context from Spec:** {q_data['context_from_spec']}\n")

            answer = q_data.get("answer", {})
            if answer:
                solution_title = answer.get("solution_title", "Custom answer")
                was_skipped = answer.get("was_skipped", False)
                custom_input = answer.get("custom_input", "")

                if was_skipped:
                    sections.append(f"\n**Decision Made:** {solution_title} ⚠️ *(Used default recommendation)*\n")
                else:
                    sections.append(f"\n**Decision Made:** {solution_title} ✅\n")

                if custom_input:
                    sections.append(f"**Additional Context:** {custom_input}\n")

                # Find the selected solution details
                selected_sol = None
                for sol in q_data.get("solutions", []):
                    if sol["id"] == answer.get("selected_solution_id"):
                        selected_sol = sol
                        break

                if selected_sol:
                    sections.append(f"\n**Benefits:**\n")
                    for benefit in selected_sol.get("benefits", []):
                        sections.append(f"- {benefit}\n")

                    sections.append(f"\n**Risks:**\n")
                    for risk in selected_sol.get("risks", []):
                        sections.append(f"- {risk}\n")

                    sections.append(f"\n**Trade-offs:**\n")
                    for tradeoff in selected_sol.get("tradeoffs", []):
                        sections.append(f"- {tradeoff}\n")

                # Show alternatives considered
                other_solutions = [s for s in q_data.get("solutions", []) if s["id"] != answer.get("selected_solution_id")]
                if other_solutions:
                    sections.append(f"\n**Other Options Considered:**\n")
                    for sol in other_solutions:
                        sections.append(f"- {sol['title']}: {sol['description']}\n")

            sections.append("\n---\n")

        return "".join(sections)

    def build_enhanced_spec(self, original_spec: str, interview_data: dict[str, Any]) -> str:
        """
        Build enhanced specification combining original spec with interview decisions.

        This is what gets passed to HLD generation.

        Args:
            original_spec: The original uploaded specification
            interview_data: The interview Q&A data

        Returns:
            Enhanced specification text
        """
        sections = []

        # Original specification
        sections.append("# Original Specification\n")
        sections.append(original_spec)
        sections.append("\n\n")

        # Interview decisions
        sections.append("# Architectural Decisions (from Interview)\n")
        sections.append(self.export_to_markdown(interview_data))

        return "\n".join(sections)
