"""
FastAPI dependency injection — wires infrastructure into application services.
All services are module-level singletons (one client per process).
"""
from __future__ import annotations

from config import get_settings
from application.characteristics_service import CharacteristicsService
from application.hld_chat import HLDChatService
from application.hld_generation import HLDGenerationService
from application.impact_service import ImpactAnalysisService
from application.interview_service import InterviewService
from infrastructure.llm.anthropic_llm import AnthropicLLM

# Shared LLM client for HLD services
_llm = AnthropicLLM(api_key=get_settings().anthropic_api_key)

# Singletons — created once at import time, reused for all requests
_characteristics_service: CharacteristicsService | None = None
_impact_service: ImpactAnalysisService | None = None
_interview_service: InterviewService | None = None
_hld_generation_service: HLDGenerationService | None = None
_hld_chat_service: HLDChatService | None = None


def get_characteristics_service() -> CharacteristicsService:
    global _characteristics_service
    if _characteristics_service is None:
        _characteristics_service = CharacteristicsService()
    return _characteristics_service


def get_impact_service() -> ImpactAnalysisService:
    global _impact_service
    if _impact_service is None:
        _impact_service = ImpactAnalysisService()
    return _impact_service


def get_hld_generation_service() -> HLDGenerationService:
    global _hld_generation_service
    if _hld_generation_service is None:
        _hld_generation_service = HLDGenerationService(_llm)
    return _hld_generation_service


def get_hld_chat_service() -> HLDChatService:
    global _hld_chat_service
    if _hld_chat_service is None:
        _hld_chat_service = HLDChatService(_llm)
    return _hld_chat_service


def get_interview_service() -> InterviewService:
    global _interview_service
    if _interview_service is None:
        _interview_service = InterviewService()
    return _interview_service


def get_llm() -> AnthropicLLM:
    return _llm
