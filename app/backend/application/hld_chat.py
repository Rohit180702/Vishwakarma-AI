"""
Use case: conversational chat grounded in an existing HLD document.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from domain.models import ChatContext, ChatMessage, HLDDocument, MessageRole
from domain.ports import LLMPort


class HLDChatService:
    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    async def reply(
        self,
        hld: HLDDocument,
        history: list[dict],
        user_message: str,
    ) -> ChatMessage:
        ctx = ChatContext(
            hld=hld,
            history=[
                ChatMessage(role=MessageRole(m["role"]), content=m["content"])
                for m in history
            ],
        )
        msg = ChatMessage(role=MessageRole.USER, content=user_message)
        return await self._llm.chat(ctx, msg)

    async def stream_reply(
        self,
        hld: HLDDocument,
        history: list[dict],
        user_message: str,
    ) -> AsyncIterator[str]:
        ctx = ChatContext(
            hld=hld,
            history=[
                ChatMessage(role=MessageRole(m["role"]), content=m["content"])
                for m in history
            ],
        )
        msg = ChatMessage(role=MessageRole.USER, content=user_message)
        return self._llm.stream_chat(ctx, msg)
