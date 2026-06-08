"""
Use case: analyse an uploaded spec document.
Accepts raw text (extracted by the API layer from a file or paste).
"""
from __future__ import annotations

from domain.models import SpecAnalysis
from domain.ports import LLMPort


class SpecAnalysisService:
    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    async def analyze(self, spec_text: str) -> SpecAnalysis:
        if not spec_text or not spec_text.strip():
            raise ValueError("spec_text must not be empty")
        return await self._llm.analyze_spec(spec_text)
