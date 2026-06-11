"""
Characteristics service for architectural quality attribute detection.
Analyzes specifications to identify and prioritize architectural characteristics.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Dict

from anthropic import AsyncAnthropic
from config import get_settings
from application.llm_utils import extract_json

logger = logging.getLogger(__name__)


class CharacteristicsService:
    """
    Service for detecting architectural characteristics from specifications.

    Follows Vishwakarma principles:
    - Evidence-based detection (no hardcoded heuristics)
    - Honest confidence scoring
    - Spec-grounded analysis only
    - Detects 0-12 characteristics based on actual evidence
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

        prompts_dir = Path(__file__).parent.parent / "prompts" / "characteristics"
        self.system_prompt = (prompts_dir / "system.md").read_text()
        self.detection_prompt = (prompts_dir / "detect.md").read_text()

        logger.info("[CharacteristicsService] Initialised with model=%s", self.model)

    async def detect_characteristics(
        self,
        spec_text: str,
    ) -> List[Dict[str, Any]]:
        """
        Analyze specification and detect architectural characteristics.

        Returns:
            List of detected characteristics, each with:
            - id, label, priority (1-10), confidence (0-100)
            - evidence, summary, rationale
            - source ('ai_detected'), locked (False), history
        """

        prompt = self.detection_prompt.format(spec_text=spec_text)

        logger.info(
            "[CharacteristicsService] Analyzing spec (%d chars) with %s",
            len(spec_text), self.model,
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
        logger.debug("[CharacteristicsService] Raw response (%d chars)", len(response_text))

        json_str = extract_json(response_text)
        logger.debug("[CharacteristicsService] Extracted JSON (%d chars)", len(json_str))

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(
                "[CharacteristicsService] JSON parse error at line %d col %d: %s\n%s",
                e.lineno, e.colno, e, json_str,
            )
            raise ValueError(f"AI generated invalid JSON: {e}") from e

        characteristics = data.get("characteristics", [])
        logger.info("[CharacteristicsService] Detected %d characteristics", len(characteristics))

        timestamp = datetime.now(timezone.utc).isoformat()
        valid: List[Dict[str, Any]] = []

        for char in characteristics:
            if "id" not in char or "label" not in char:
                logger.warning("[CharacteristicsService] Skipping invalid characteristic: %s", char)
                continue

            if char.get("confidence", 0) < 30:
                logger.debug(
                    "[CharacteristicsService] Filtered out %s (confidence=%d < 30)",
                    char["label"], char.get("confidence", 0),
                )
                continue

            char["source"] = "ai_detected"
            char["locked"] = False
            char["history"] = [{
                "phase": "detection",
                "priority": char.get("priority", 5),
                "timestamp": timestamp,
            }]

            logger.debug(
                "  - %s: priority=%d/10 confidence=%d%%",
                char["label"], char.get("priority", 5), char.get("confidence", 0),
            )
            valid.append(char)

        return valid

