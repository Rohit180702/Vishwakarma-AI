"""
Domain ports — abstract interfaces that infrastructure must implement.
Application layer depends only on these; never on concrete adapters.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from domain.models import (
    ChatContext,
    ChatMessage,
    HLDDocument,
    HLDTemplate,
)


class LLMPort(ABC):
    """Abstraction over any LLM provider (Anthropic, OpenAI, …)."""

    @abstractmethod
    async def generate_hld(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        thoughtworks_mode: bool = False,
    ) -> HLDDocument:
        """Generate a full HLD document from raw spec text."""

    @abstractmethod
    async def stream_hld(
        self,
        spec_text: str,
        template: HLDTemplate,
        custom_sections: list[str] | None = None,
        custom_template_text: str | None = None,
        thoughtworks_mode: bool = False,
    ) -> AsyncIterator[str]:
        """Stream HLD generation tokens from raw spec text."""

    @abstractmethod
    async def chat(self, ctx: ChatContext, user_message: ChatMessage) -> ChatMessage:
        """Single-turn chat grounded in an HLD document."""

    @abstractmethod
    async def stream_chat(
        self,
        ctx: ChatContext,
        user_message: ChatMessage,
    ) -> AsyncIterator[str]:
        """Streaming chat grounded in an HLD document."""
