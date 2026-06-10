"""
Use case: generate an HLD document from raw spec text + chosen template.
Supports both full (await) and streaming (async-iterate) modes.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from domain.models import HLDDocument, HLDTemplate
from domain.ports import LLMPort


class HLDGenerationService:
    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    async def generate(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        thoughtworks_mode: bool = False,
    ) -> HLDDocument:
        return await self._llm.generate_hld(
            spec_text, template, custom_sections, custom_template_text, thoughtworks_mode,
        )

    async def stream(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        thoughtworks_mode: bool = False,
    ) -> AsyncIterator[str]:
        return await self._llm.stream_hld(
            spec_text, template, custom_sections, custom_template_text, thoughtworks_mode,
        )
