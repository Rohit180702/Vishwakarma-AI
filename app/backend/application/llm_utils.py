"""
Shared utilities for LLM response parsing.
"""
from __future__ import annotations

import re

# Matches ```json ... ``` or ``` ... ``` fences, case-insensitive
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", re.IGNORECASE)


def extract_json(text: str) -> str:
    """
    Extract the first JSON object from an LLM response.

    Handles three common formats:
      1. ```json { ... } ```  (fenced with language tag)
      2. ``` { ... } ```       (fenced without language tag)
      3. bare { ... }          (no fences at all)
    """
    match = _JSON_FENCE_RE.search(text)
    if match:
        return match.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1].strip()

    return text.strip()
