from domain.models import HLDTemplate


# ---------------------------------------------------------------------------
# Template metadata — used by both API responses and LLM prompts
# ---------------------------------------------------------------------------

TEMPLATE_META: dict[HLDTemplate, dict] = {
    HLDTemplate.ARC42: {
        "name": "arc42",
        "standard": "arc42 v9 (July 2025)",
        "description": "Structured, pragmatic 12-section architecture documentation template. The most widely adopted standard across consulting and enterprise delivery teams.",
        "section_count": 12,
        "good_for": ["Enterprise", "Regulated industries", "Consulting delivery"],
        "sections": [
            ("1", "Introduction and Goals"),
            ("2", "Architecture Constraints"),
            ("3", "Context and Scope"),
            ("4", "Solution Strategy"),
            ("5", "Building Block View"),
            ("6", "Runtime View"),
            ("7", "Deployment View"),
            ("8", "Cross-cutting Concepts"),
            ("9", "Architecture Decisions"),
            ("10", "Quality Requirements"),
            ("11", "Risks and Technical Debt"),
            ("12", "Glossary"),
        ],
    },
    HLDTemplate.C4_ADR: {
        "name": "C4 + ADR",
        "standard": "C4 Model + Michael Nygard ADR",
        "description": "Modern lightweight format: system context → containers → components → one ADR per major decision. Endorsed by Thoughtworks Tech Radar. Popular in product-led engineering teams.",
        "section_count": 6,
        "good_for": ["Product engineering", "Microservices", "Modern teams"],
        "sections": [
            ("1", "System Overview"),
            ("2", "C4 Context — System and Actors"),
            ("3", "C4 Container — Services and Data Stores"),
            ("4", "C4 Component — Internal Structure"),
            ("5", "Architecture Decision Records"),
            ("6", "Risks and Open Questions"),
        ],
    },
    HLDTemplate.RFC_DESIGN_DOC: {
        "name": "RFC / Design Doc",
        "standard": "Google Design Doc (2024)",
        "description": "Engineering format used at Google, Stripe, Amazon, and Linear. Forces explicit problem framing, alternatives considered, and trade-offs before implementation starts.",
        "section_count": 8,
        "good_for": ["Product & platform teams", "Pre-implementation alignment", "Staff+ engineers"],
        "sections": [
            ("TL;DR", "Summary"),
            ("1", "Context & Scope"),
            ("2", "Goals and Non-Goals"),
            ("3", "Technical Design"),
            ("4", "Alternatives Considered"),
            ("5", "Cross-cutting Concerns"),
            ("6", "Risks"),
            ("7", "Rollout Plan"),
        ],
    },
}
