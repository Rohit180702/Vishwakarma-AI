"""
API response models — what the HTTP layer serializes to JSON.
"""
from __future__ import annotations

from pydantic import BaseModel


class C4NodeOut(BaseModel):
    id: str
    type: str
    label: str
    description: str = ""
    technology: str = ""


class C4RelationshipOut(BaseModel):
    from_id: str
    to_id: str
    label: str = ""
    technology: str = ""
    async_comm: bool = False


class C4BoundaryOut(BaseModel):
    id: str
    label: str
    node_ids: list[str] = []


class C4DiagramOut(BaseModel):
    level: str
    title: str = ""
    nodes: list[C4NodeOut] = []
    relationships: list[C4RelationshipOut] = []
    boundaries: list[C4BoundaryOut] = []
    mermaid_syntax: str = ""  # sequence diagrams only


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


class StrictCheckOut(BaseModel):
    id: str
    label: str
    passed: bool
    message: str
    tier: str                  # "STR" | "SEM"
    template_specific: bool


class StrictQualityReportOut(BaseModel):
    template: str
    passed: bool
    score: int
    structural_score: int
    semantic_score: int
    checks: list[StrictCheckOut]


class ChatResponse(BaseModel):
    role: str
    content: str


class ErrorResponse(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    errors: list[dict] = []
