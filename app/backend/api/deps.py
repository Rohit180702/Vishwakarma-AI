"""
FastAPI dependency injection — wires infrastructure into application services.
AnthropicLLM is a module-level singleton (one client per process).
"""
from __future__ import annotations

from config import get_settings
from application.hld_chat import HLDChatService
from application.hld_generation import HLDGenerationService
from application.interview_service import InterviewService
from infrastructure.llm.anthropic_llm import AnthropicLLM

# Single shared LLM client — created once at import time
_llm = AnthropicLLM(api_key=get_settings().anthropic_api_key)


def get_hld_generation_service() -> HLDGenerationService:
    return HLDGenerationService(_llm)


def get_hld_chat_service() -> HLDChatService:
    return HLDChatService(_llm)


def get_interview_service() -> InterviewService:
    return InterviewService(_llm)
