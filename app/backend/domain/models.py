"""
Domain models — pure Python, zero framework imports.
These are the core data shapes the application reasons about.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class HLDTemplate(str, Enum):
    ARC42 = "arc42"
    C4_ADR = "c4-adr"
    RFC_DESIGN_DOC = "rfc-design-doc"
    CUSTOM = "custom"


class DiagramLevel(str, Enum):
    CONTEXT = "context"       # C4 L1 — system + external actors
    CONTAINER = "container"   # C4 L2 — services, databases, queues
    COMPONENT = "component"   # C4 L3 — internals of one container
    SEQUENCE = "sequence"     # Mermaid sequenceDiagram — runtime view scenarios
    DEPLOYMENT = "deployment" # Infrastructure topology — nodes, zones, services


class C4NodeType(str, Enum):
    PERSON = "person"               # human actor (user, admin)
    SYSTEM = "system"               # our software system (inside boundary)
    EXTERNAL_SYSTEM = "external_system"  # third-party / out-of-scope system
    CONTAINER = "container"         # deployable unit (service, app, DB wrapper)
    COMPONENT = "component"         # logical component inside a container
    DATABASE = "database"           # data store
    QUEUE = "queue"                 # message queue / event bus
    CACHE = "cache"                 # in-memory cache
    FRONTEND = "frontend"           # web/mobile UI (client-side)
    CLOUD_SERVICE = "cloud_service" # managed cloud service (S3, CDN, etc.)


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


# ---------------------------------------------------------------------------
# HLD quality guardrail report
# ---------------------------------------------------------------------------

@dataclass
class QualityCheck:
    id: str        # e.g. "CRIT-001", "HIGH-003"
    label: str     # human-readable rule name
    passed: bool
    message: str   # what passed or what failed


@dataclass
class HLDQualityReport:
    passed: bool               # all checks passed
    score: int                 # 0–100, percent of checks that passed
    checks: list[QualityCheck]
    should_retry: bool         # true if any CRIT check failed


# ---------------------------------------------------------------------------
# HLD document
# ---------------------------------------------------------------------------

@dataclass
class HLDSection:
    key: str            # e.g. "overview", "technical-design"
    number: str         # e.g. "1", "3.2"
    title: str
    content: str        # Markdown body
    reviewer: Optional[str] = None   # role responsible for sign-off


@dataclass
class ADRAlternative:
    option: str
    pros: list[str]
    cons: list[str]


@dataclass
class ADR:
    id: str             # e.g. "ADR-001"
    title: str          # noun phrase: "Use PostgreSQL for Primary Data Store"
    status: str         # Accepted | Proposed | Superseded
    context: str        # value-neutral forces that drove the decision
    decision: str       # "We will…" — active voice
    alternatives: list[ADRAlternative]   # MADR: options considered with pros/cons
    consequences_positive: list[str]     # honest trade-off — positive
    consequences_negative: list[str]     # honest trade-off — negative (required)
    cost_band: str      # $ | $$ | $$$


@dataclass
class C4Node:
    id: str
    type: C4NodeType
    label: str
    description: str = ""
    technology: str = ""       # e.g. "React 18", "PostgreSQL 16", "Stripe API"


@dataclass
class C4Relationship:
    from_id: str
    to_id: str
    label: str = ""
    technology: str = ""       # e.g. "REST/HTTPS", "gRPC", "AMQP"
    async_comm: bool = False   # true for async/event-driven links


@dataclass
class C4Boundary:
    id: str
    label: str
    node_ids: list[str] = field(default_factory=list)  # node IDs inside this boundary


@dataclass
class C4Diagram:
    level: DiagramLevel
    title: str = ""
    nodes: list[C4Node] = field(default_factory=list)
    relationships: list[C4Relationship] = field(default_factory=list)
    boundaries: list[C4Boundary] = field(default_factory=list)
    mermaid_syntax: str = ""   # only used for level == sequence


@dataclass
class HLDDocument:
    project_name: str
    template: HLDTemplate
    sections: list[HLDSection]
    adrs: list[ADR]
    diagrams: list[C4Diagram]
    quality_report: Optional[HLDQualityReport] = None


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@dataclass
class ChatMessage:
    role: MessageRole
    content: str


@dataclass
class ChatContext:
    """Everything the chat agent needs to give grounded answers."""
    hld: HLDDocument
    history: list[ChatMessage] = field(default_factory=list)
