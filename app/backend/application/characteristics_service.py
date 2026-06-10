"""
Characteristics service for architectural quality attribute detection.
Analyzes specifications to identify and prioritize architectural characteristics.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Dict

from anthropic import AsyncAnthropic
from config import get_settings


class CharacteristicsService:
    """
    Service for detecting architectural characteristics from specifications.

    Follows Vishwakarma principles:
    - Evidence-based detection (no hardcoded heuristics)
    - Honest confidence scoring
    - Spec-grounded analysis only
    - Detects 0-12 characteristics based on actual evidence
    """

    def __init__(self, llm=None):
        """Initialize with Anthropic client and load prompts."""
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

        # Load prompts
        prompts_dir = Path(__file__).parent.parent / "prompts" / "characteristics"
        self.system_prompt = (prompts_dir / "system.md").read_text()
        self.detection_prompt = (prompts_dir / "detect.md").read_text()

    async def detect_characteristics(
        self,
        spec_text: str
    ) -> List[Dict[str, Any]]:
        """
        Analyze specification and detect architectural characteristics.

        Args:
            spec_text: The unified specification text from uploaded documents

        Returns:
            List of detected characteristics, each with:
            - id: snake_case identifier (e.g., "availability", "cost_efficiency")
            - label: Human-readable name (e.g., "Availability", "Cost Efficiency")
            - priority: AI-suggested priority 1-10 based on spec signals
            - confidence: Detection certainty 0-100 (only ≥30% included)
            - evidence: List of spec quotes that triggered detection
            - rationale: Why this matters for THIS system
            - source: Always 'ai_detected' initially
            - locked: Always False initially (user can reorder)
            - history: Audit trail of priority changes

        Note: May return empty list if spec provides insufficient signals.
              This is by design - precision over completeness.
        """

        prompt = self.detection_prompt.format(spec_text=spec_text)

        print(f"\n[CharacteristicsService] Analyzing spec ({len(spec_text)} chars)...")
        print(f"[CharacteristicsService] Model: {self.model}")

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            temperature=0.0,  # Deterministic for consistency
            system=self.system_prompt,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text
        print(f"\n[CharacteristicsService] AI response ({len(response_text)} chars)")

        # Extract JSON (handle markdown fences if present)
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
        else:
            json_str = response_text.strip()

        print(f"[CharacteristicsService] Extracted JSON ({len(json_str)} chars)")

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"\n[CharacteristicsService] ❌ JSON PARSE ERROR: {str(e)}")
            print(f"[CharacteristicsService] Error at line {e.lineno}, column {e.colno}")
            print(f"\n[CharacteristicsService] Problematic JSON:\n{json_str}")
            raise ValueError(f"AI generated invalid JSON: {str(e)}")

        characteristics = data.get("characteristics", [])

        print(f"\n[CharacteristicsService] Detected {len(characteristics)} characteristics")

        # Enrich with metadata for tracking
        timestamp = datetime.now(timezone.utc).isoformat()
        for char in characteristics:
            # Ensure all required fields
            if 'id' not in char or 'label' not in char:
                print(f"[CharacteristicsService] ⚠️ Skipping invalid characteristic: {char}")
                continue

            char['source'] = 'ai_detected'
            char['locked'] = False
            char['history'] = [{
                'phase': 'detection',
                'priority': char.get('priority', 5),
                'timestamp': timestamp
            }]

            print(f"  - {char['label']}: priority={char.get('priority')}/10, confidence={char.get('confidence')}%")

        # Validate confidence threshold
        valid_chars = [c for c in characteristics if c.get('confidence', 0) >= 30]

        if len(valid_chars) < len(characteristics):
            print(f"[CharacteristicsService] ⚠️ Filtered out {len(characteristics) - len(valid_chars)} characteristics with confidence <30%")

        return valid_chars
