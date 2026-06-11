"""
Impact analysis service for evaluating architectural trade-offs.
Analyzes how interview decisions affect prioritized characteristics.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from anthropic import AsyncAnthropic
from config import get_settings
from application.llm_utils import extract_json

logger = logging.getLogger(__name__)


class ImpactAnalysisService:
    """
    Service for analyzing the impact of interview decisions on architectural characteristics.

    Compares user's chosen solution against AI-recommended solution to identify trade-offs.
    """

    def __init__(self):
        """Initialize with Anthropic client and load prompts."""
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

        # Load prompts
        prompts_dir = Path(__file__).parent.parent / "prompts" / "impact"
        self.system_prompt = (prompts_dir / "system.md").read_text()
        self.analysis_prompt = (prompts_dir / "analyze.md").read_text()

    async def analyze_impact(
        self,
        characteristics: List[Dict[str, Any]],
        question: Dict[str, Any],
        recommended_solution: Dict[str, Any],
        chosen_solution: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze impact of chosen solution vs recommended solution.

        Args:
            characteristics: User's prioritized characteristics from characteristics.json
            question: The interview question being answered
            recommended_solution: The AI-recommended solution
            chosen_solution: The solution user actually selected

        Returns:
            Impact analysis with severity, affected characteristics, and educational insights
        """

        # If user chose the recommended solution, return low severity
        if chosen_solution['id'] == recommended_solution['id']:
            return {
                "severity": "low",
                "is_recommended": True,
                "affected_characteristics": [],
                "summary": "You selected the recommended solution that aligns with your priorities.",
                "recommendation_rationale": "This solution was recommended based on your prioritized characteristics.",
                "tradeoff_insight": "No significant trade-offs - this choice supports your architectural goals."
            }

        # Format characteristics for prompt
        # Only include top 5 for conciseness
        top_characteristics = sorted(characteristics, key=lambda x: x.get('priority', 0), reverse=True)[:5]
        characteristics_json = json.dumps(top_characteristics, indent=2)

        # Build analysis prompt
        prompt = self.analysis_prompt.format(
            characteristics_json=characteristics_json,
            question_id=question['id'],
            question_text=question['question'],
            why_critical=question.get('why_critical', 'N/A'),
            context_from_spec=question.get('context_from_spec', 'N/A'),
            recommended_solution_id=recommended_solution['id'],
            recommended_solution_title=recommended_solution['title'],
            recommended_solution_description=recommended_solution['description'],
            chosen_solution_id=chosen_solution['id'],
            chosen_solution_title=chosen_solution['title'],
            chosen_solution_description=chosen_solution['description']
        )

        logger.info("[ImpactService] Analyzing trade-off — question=%s recommended=%s chosen=%s",
                    question["id"], recommended_solution["title"], chosen_solution["title"])

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            temperature=0.0,
            system=self.system_prompt,
            messages=[{"role": "user", "content": prompt}],
            timeout=120.0,
        )

        response_text = response.content[0].text
        json_str = extract_json(response_text)

        try:
            analysis = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error("[ImpactService] JSON parse error at line %d col %d: %s", e.lineno, e.colno, e)
            return {
                "severity": "moderate",
                "is_recommended": False,
                "affected_characteristics": [],
                "summary": "Your choice differs from the recommendation. Consider the trade-offs carefully.",
                "recommendation_rationale": f"The recommended solution ({recommended_solution['title']}) was suggested based on your priorities.",
                "tradeoff_insight": "Unable to perform detailed analysis. Please review both options carefully."
            }

        # Add metadata
        analysis['is_recommended'] = False
        analysis['chosen_solution'] = {
            'id': chosen_solution['id'],
            'title': chosen_solution['title']
        }
        analysis['recommended_solution'] = {
            'id': recommended_solution['id'],
            'title': recommended_solution['title']
        }

        logger.info("[ImpactService] severity=%s affected_characteristics=%d",
                    analysis.get("severity"), len(analysis.get("affected_characteristics", [])))

        return analysis
