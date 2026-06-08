"""
API response models — what the HTTP layer serializes to JSON.
"""
from __future__ import annotations

from pydantic import BaseModel


class QualityDimensionOut(BaseModel):
    id: str
    label: str
    score: int
    feedback: str


class AnalyzeSpecResponse(BaseModel):
    domain: str
    project_name: str
    overall_score: int
    quality_level: str
    dimensions: list[QualityDimensionOut]
    missing_inputs: list[str]


class C4DiagramOut(BaseModel):
    level: str
    mermaid_syntax: str


class HLDSectionOut(BaseModel):
    key: str
    number: str
    title: str
    content: str
    reviewer: str | None = None


class ADRAlternativeOut(BaseModel):
    option: str
    pros: list[str] = []
    cons: list[str] = []


class ADROut(BaseModel):
    id: str
    title: str
    status: str
    context: str
    decision: str
    alternatives: list[ADRAlternativeOut] = []
    consequences_positive: list[str] = []
    consequences_negative: list[str] = []
    cost_band: str


class QualityCheckOut(BaseModel):
    id: str
    label: str
    passed: bool
    message: str


class HLDQualityReportOut(BaseModel):
    passed: bool
    score: int
    checks: list[QualityCheckOut]
    should_retry: bool


class GenerateHLDResponse(BaseModel):
    project_name: str
    template: str
    sections: list[HLDSectionOut]
    adrs: list[ADROut]
    diagrams: list[C4DiagramOut]
    quality_report: HLDQualityReportOut | None = None


class ChatResponse(BaseModel):
    role: str
    content: str


class ErrorResponse(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    errors: list[dict] = []
