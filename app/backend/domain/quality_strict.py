"""
Strict HLD quality validator — template-aware, harder checks.

Two tiers:
  STR-*  — structural conformance (is the right shape present?)
  SEM-*  — semantic depth (is the content substantive?)

Designed to catch shallow / padded / off-template output that passes the basic
10-check guardrail but would fail a real architecture review.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from domain.models import HLDDocument, HLDTemplate

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# At least 3 distinct measurable NFR targets anywhere in the document
_MEASURABLE_RE = re.compile(
    r"\d[\d,\s]*\s*(ms|rps|rpm|req/s|requests?/s|%\s*(availability|uptime|error|slo)|"
    r"tps|transactions?/s|s\b|seconds?|minutes?)",
    re.IGNORECASE,
)

# TBD without evaluation criteria — indicates a deferred decision with no plan
_BARE_TBD_RE = re.compile(r"\bTBD\b(?!\s*[—–-]\s*(?:decision needed|evaluation criteria))", re.IGNORECASE)

# SEI long-form quality scenario keywords
_SEI_KEYWORDS = frozenset(["stimulus", "response measure", "environment", "artifact"])

# Security surface keywords — both auth and authz must appear
_AUTH_RE    = re.compile(r"\b(authentication|jwt|oauth|sso|saml|api.?key|bearer|login)\b", re.IGNORECASE)
_AUTHZ_RE   = re.compile(r"\b(authori[sz]ation|rbac|acl|role.based|permission|access.control)\b", re.IGNORECASE)
_SECURITY_RE = re.compile(r"\b(encrypt|tls|ssl|pci|gdpr|hipaa|cve|vulnerability|secret|vault)\b", re.IGNORECASE)

# Observability
_OBS_RE = re.compile(r"\b(logging|logs?|metrics?|tracing?|monitoring|alerting|slo|sli|sla|dashboard)\b", re.IGNORECASE)

# -------------- arc42 -----------------
ARC42_REQUIRED_SECTION_KEYWORDS = {
    "introduction":   ("Introduction", "introduction", "intro"),
    "constraints":    ("Constraint", "constraint"),
    "context":        ("Context", "context", "scope"),
    "solution":       ("Solution", "strategy", "approach"),
    "building":       ("Building Block", "building block", "component view"),
    "runtime":        ("Runtime", "runtime view"),
    "deployment":     ("Deployment", "deployment view"),
    "crosscutting":   ("Crosscutting", "Cross-cutting", "crosscutting"),
    "decisions":      ("Decision", "ADR", "decision"),
    "quality":        ("Quality", "quality requirement"),
    "risks":          ("Risk", "Technical Debt", "risk"),
    "glossary":       ("Glossary", "glossary"),
}

# -------------- C4+ADR -----------------
C4_REQUIRED_SECTION_KEYWORDS = {
    "overview":   ("Overview", "overview", "system overview"),
    "context":    ("Context", "context diagram"),
    "container":  ("Container", "container diagram"),
    "adrs":       ("Decision", "ADR", "Architecture Decision"),
    "risks":      ("Risk", "risk"),
}

# -------------- RFC -----------------
RFC_REQUIRED_SECTION_KEYWORDS = {
    "tldr":         ("TL;DR", "tldr", "summary", "executive"),
    "context":      ("Context", "background", "problem"),
    "goals":        ("Goal", "Non-Goal", "goal"),
    "design":       ("Design", "technical design", "technical approach"),
    "alternatives": ("Alternative", "considered", "option"),
    "risks":        ("Risk", "risk"),
    "rollout":      ("Rollout", "migration", "deployment plan", "launch"),
}

# -------------- Shared -----------------
MIN_SECTION_CHARS_STRICT = 400   # raised from 100
MIN_ADRS_STRICT = {
    "arc42":          4,
    "c4-adr":         4,
    "rfc-design-doc": 3,
    "custom":         3,
}
MIN_DIAGRAMS_STRICT = 2  # L1 + L2 minimum


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------

@dataclass
class StrictCheck:
    id: str
    label: str
    passed: bool
    message: str
    tier: str   # "STR" | "SEM"
    template_specific: bool = False


@dataclass
class StrictQualityReport:
    template: str
    passed: bool
    score: int           # 0–100
    structural_score: int
    semantic_score: int
    checks: list[StrictCheck] = field(default_factory=list)

    @property
    def failed_checks(self) -> list[StrictCheck]:
        return [c for c in self.checks if not c.passed]


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

class HLDStrictValidator:
    """
    Template-aware strict validator. Returns a StrictQualityReport with 20+
    checks across structural conformance and semantic depth dimensions.
    """

    def validate(self, doc: "HLDDocument") -> StrictQualityReport:
        template = doc.template.value
        full_text = " ".join(s.content for s in doc.sections)
        section_titles = [s.title.lower() for s in doc.sections]

        checks: list[StrictCheck] = []

        # ── Shared structural checks ─────────────────────────────────────
        checks += self._shared_structural(doc, full_text, template)

        # ── Shared semantic checks ────────────────────────────────────────
        checks += self._shared_semantic(doc, full_text)

        # ── Template-specific checks ──────────────────────────────────────
        if template == "arc42":
            checks += self._arc42_checks(doc, full_text, section_titles)
        elif template == "c4-adr":
            checks += self._c4adr_checks(doc, full_text, section_titles)
        elif template == "rfc-design-doc":
            checks += self._rfc_checks(doc, full_text, section_titles)

        str_checks = [c for c in checks if c.tier == "STR"]
        sem_checks = [c for c in checks if c.tier == "SEM"]

        str_score  = round(sum(1 for c in str_checks if c.passed) / max(len(str_checks), 1) * 100)
        sem_score  = round(sum(1 for c in sem_checks if c.passed) / max(len(sem_checks), 1) * 100)
        total      = round(sum(1 for c in checks if c.passed) / max(len(checks), 1) * 100)

        return StrictQualityReport(
            template=template,
            passed=all(c.passed for c in checks),
            score=total,
            structural_score=str_score,
            semantic_score=sem_score,
            checks=checks,
        )

    # ── Shared structural ────────────────────────────────────────────────

    def _shared_structural(self, doc: "HLDDocument", full_text: str, template: str) -> list[StrictCheck]:
        checks = []

        # STR-001: Section content depth (strict — 400 chars)
        thin = [s.title for s in doc.sections if len(s.content.strip()) < MIN_SECTION_CHARS_STRICT]
        checks.append(StrictCheck(
            id="STR-001", tier="STR",
            label=f"Section depth ≥ {MIN_SECTION_CHARS_STRICT} chars each",
            passed=len(thin) == 0,
            message=(
                f"Thin sections (<{MIN_SECTION_CHARS_STRICT} chars): {', '.join(thin)}"
                if thin else "All sections have substantive depth."
            ),
        ))

        # STR-002: ADR count (template-specific floor)
        min_adrs = MIN_ADRS_STRICT.get(template, 3)
        n_adrs   = len(doc.adrs)
        checks.append(StrictCheck(
            id="STR-002", tier="STR",
            label=f"ADRs ≥ {min_adrs} for {template}",
            passed=n_adrs >= min_adrs,
            message=f"{n_adrs} ADRs — {'OK' if n_adrs >= min_adrs else f'need {min_adrs}'}.",
        ))

        # STR-003: Diagrams ≥ 2 (L1 + L2 at minimum)
        levels  = {d.level.value for d in doc.diagrams}
        has_l1  = "context"   in levels
        has_l2  = "container" in levels
        checks.append(StrictCheck(
            id="STR-003", tier="STR",
            label="Context (L1) + Container (L2) diagrams both present",
            passed=has_l1 and has_l2,
            message=(
                f"Missing: {'L1' if not has_l1 else ''} {'L2' if not has_l2 else ''}".strip()
                if not (has_l1 and has_l2) else "L1 and L2 diagrams present."
            ),
        ))

        # STR-004: Every ADR has ≥1 alternative with both pros AND cons
        weak_adrs = [
            a.id for a in doc.adrs
            if not a.alternatives or any(
                len(alt.pros) == 0 or len(alt.cons) == 0
                for alt in a.alternatives
            )
        ]
        checks.append(StrictCheck(
            id="STR-004", tier="STR",
            label="All ADR alternatives have both pros and cons",
            passed=len(weak_adrs) == 0,
            message=(
                f"ADRs with missing pros/cons in alternatives: {', '.join(weak_adrs)}"
                if weak_adrs else "All ADR alternatives documented with pros and cons."
            ),
        ))

        # STR-005: Every ADR has substantive negative consequence (≥ 30 chars)
        shallow_adrs = [
            a.id for a in doc.adrs
            if not a.consequences_negative
            or all(len(c.strip()) < 30 for c in a.consequences_negative)
        ]
        checks.append(StrictCheck(
            id="STR-005", tier="STR",
            label="ADR negative consequences substantive (≥ 30 chars each)",
            passed=len(shallow_adrs) == 0,
            message=(
                f"ADRs with shallow/missing trade-offs: {', '.join(shallow_adrs)}"
                if shallow_adrs else "All ADRs have substantive trade-off statements."
            ),
        ))

        return checks

    # ── Shared semantic ──────────────────────────────────────────────────

    def _shared_semantic(self, doc: "HLDDocument", full_text: str) -> list[StrictCheck]:
        checks = []

        # SEM-001: At least 3 distinct measurable NFR targets
        matches = _MEASURABLE_RE.findall(full_text)
        checks.append(StrictCheck(
            id="SEM-001", tier="SEM",
            label="≥ 3 measurable NFR targets (number + unit)",
            passed=len(matches) >= 3,
            message=(
                f"Only {len(matches)} measurable NFR target(s) found — need at least 3."
                if len(matches) < 3 else f"{len(matches)} measurable NFR targets present."
            ),
        ))

        # SEM-002: Security — auth AND authz covered
        has_auth   = bool(_AUTH_RE.search(full_text))
        has_authz  = bool(_AUTHZ_RE.search(full_text))
        has_sec    = bool(_SECURITY_RE.search(full_text))
        checks.append(StrictCheck(
            id="SEM-002", tier="SEM",
            label="Security: authentication + authorisation both addressed",
            passed=has_auth and has_authz,
            message=(
                f"Missing: {'authentication ' if not has_auth else ''}{'authorisation' if not has_authz else ''}".strip()
                if not (has_auth and has_authz)
                else "Authentication and authorisation both addressed."
            ),
        ))

        # SEM-003: Observability coverage
        checks.append(StrictCheck(
            id="SEM-003", tier="SEM",
            label="Observability addressed (logging/metrics/monitoring/tracing)",
            passed=bool(_OBS_RE.search(full_text)),
            message=(
                "No observability coverage found (logging, metrics, tracing, monitoring)."
                if not _OBS_RE.search(full_text)
                else "Observability addressed."
            ),
        ))

        # SEM-004: No bare TBDs without evaluation criteria
        bare_tbds = _BARE_TBD_RE.findall(full_text)
        checks.append(StrictCheck(
            id="SEM-004", tier="SEM",
            label="No bare TBDs (every TBD has evaluation criteria)",
            passed=len(bare_tbds) == 0,
            message=(
                f"{len(bare_tbds)} bare TBD(s) found without evaluation criteria."
                if bare_tbds else "All TBDs include evaluation criteria."
            ),
        ))

        # SEM-005: ADR titles are noun phrases (contain "for", "as", "over", "in" — decision language)
        vague_adrs = [
            a.id for a in doc.adrs
            if len(a.title.split()) < 4
        ]
        checks.append(StrictCheck(
            id="SEM-005", tier="SEM",
            label="ADR titles are descriptive noun phrases (≥ 4 words)",
            passed=len(vague_adrs) == 0,
            message=(
                f"Vague/short ADR titles in: {', '.join(vague_adrs)}"
                if vague_adrs else "All ADR titles are descriptive noun phrases."
            ),
        ))

        # SEM-006: ADR decisions use active voice ("We will")
        passive_adrs = [
            a.id for a in doc.adrs
            if not re.search(r"\bwe will\b", a.decision, re.IGNORECASE)
        ]
        checks.append(StrictCheck(
            id="SEM-006", tier="SEM",
            label='ADR decisions use active voice ("We will…")',
            passed=len(passive_adrs) == 0,
            message=(
                f"ADRs without 'We will' in decision: {', '.join(passive_adrs)}"
                if passive_adrs else "All ADRs use active-voice decision statements."
            ),
        ))

        return checks

    # ── arc42-specific ───────────────────────────────────────────────────

    def _arc42_checks(self, doc: "HLDDocument", full_text: str, titles: list[str]) -> list[StrictCheck]:
        checks = []

        def has_section(keywords: tuple) -> bool:
            return any(kw.lower() in t for t in titles for kw in keywords)

        # STR-A01: All 12 standard arc42 sections present
        missing = [
            name for name, kws in ARC42_REQUIRED_SECTION_KEYWORDS.items()
            if not has_section(kws)
        ]
        checks.append(StrictCheck(
            id="STR-A01", tier="STR", template_specific=True,
            label="All 12 arc42 sections present",
            passed=len(missing) == 0,
            message=(
                f"Missing arc42 sections: {', '.join(missing)}"
                if missing else "All 12 arc42 sections present."
            ),
        ))

        # STR-A02: Section 3 has business AND technical context
        ctx_section = next((s for s in doc.sections if "context" in s.title.lower() or "scope" in s.title.lower()), None)
        has_biz = ctx_section and re.search(r"\bbusiness\b", ctx_section.content, re.IGNORECASE)
        has_tec = ctx_section and re.search(r"\btechnical\b", ctx_section.content, re.IGNORECASE)
        checks.append(StrictCheck(
            id="STR-A02", tier="STR", template_specific=True,
            label="Section 3: business context AND technical context both present",
            passed=bool(has_biz and has_tec),
            message=(
                f"Context section missing: {'business context ' if not has_biz else ''}{'technical context' if not has_tec else ''}".strip()
                if not (has_biz and has_tec)
                else "Business and technical context both documented."
            ),
        ))

        # STR-A03: Sequence diagrams present (arc42 requires runtime scenarios)
        levels = {d.level.value for d in doc.diagrams}
        checks.append(StrictCheck(
            id="STR-A03", tier="STR", template_specific=True,
            label="Sequence diagram(s) present for runtime scenarios",
            passed="sequence" in levels,
            message=(
                "No sequence diagrams found — arc42 §6 Runtime View requires scenario diagrams."
                if "sequence" not in levels else f"Sequence diagram(s) present."
            ),
        ))

        # STR-A04: Deployment view has building-block-to-node mapping
        dep_section = next((s for s in doc.sections if "deployment" in s.title.lower()), None)
        has_table   = dep_section and ("|" in dep_section.content or re.search(r"\|\s*\w+", dep_section.content))
        checks.append(StrictCheck(
            id="STR-A04", tier="STR", template_specific=True,
            label="Deployment view contains BB-to-node mapping table",
            passed=bool(has_table),
            message=(
                "Deployment view has no table — arc42 §7 requires a BB-to-node mapping."
                if not has_table else "Building-block-to-node mapping table present."
            ),
        ))

        # SEM-A01: Quality scenarios use SEI long form (stimulus + response measure)
        quality_section = next((s for s in doc.sections if "quality" in s.title.lower()), None)
        has_sei = quality_section and sum(
            1 for kw in _SEI_KEYWORDS if kw in quality_section.content.lower()
        ) >= 2
        checks.append(StrictCheck(
            id="SEM-A01", tier="SEM", template_specific=True,
            label="Quality scenarios use SEI long form (stimulus + response measure)",
            passed=bool(has_sei),
            message=(
                "Quality section lacks SEI scenario structure (stimulus, response measure, environment)."
                if not has_sei else "SEI long-form quality scenarios present."
            ),
        ))

        # SEM-A02: Glossary has ≥ 3 entries
        glossary = next((s for s in doc.sections if "glossary" in s.title.lower()), None)
        if glossary:
            # count table rows or bullet/dash definitions
            entry_count = len(re.findall(r"(\|\s*\w|\n[-*]\s+\*\*|\n\*\*)", glossary.content))
            has_glossary_entries = entry_count >= 3 or len(glossary.content.split("\n")) >= 5
        else:
            has_glossary_entries = False
        checks.append(StrictCheck(
            id="SEM-A02", tier="SEM", template_specific=True,
            label="Glossary has ≥ 3 defined terms",
            passed=has_glossary_entries,
            message=(
                "Glossary is empty or too sparse (< 3 entries)."
                if not has_glossary_entries else "Glossary populated with domain terms."
            ),
        ))

        # SEM-A03: Building block view mentions team ownership
        bb_section = next((s for s in doc.sections if "building" in s.title.lower()), None)
        has_ownership = bb_section and re.search(r"\b(owned by|owning team|team:)\b", bb_section.content, re.IGNORECASE)
        checks.append(StrictCheck(
            id="SEM-A03", tier="SEM", template_specific=True,
            label="Building Block View states team ownership per block",
            passed=bool(has_ownership),
            message=(
                "No team ownership found in Building Block View — arc42 §5 should state who owns each block."
                if not has_ownership else "Team ownership referenced in Building Block View."
            ),
        ))

        return checks

    # ── C4+ADR-specific ──────────────────────────────────────────────────

    def _c4adr_checks(self, doc: "HLDDocument", full_text: str, titles: list[str]) -> list[StrictCheck]:
        checks = []

        def has_section(keywords: tuple) -> bool:
            return any(kw.lower() in t for t in titles for kw in keywords)

        # STR-C01: All required C4 sections present
        missing = [
            name for name, kws in C4_REQUIRED_SECTION_KEYWORDS.items()
            if not has_section(kws)
        ]
        checks.append(StrictCheck(
            id="STR-C01", tier="STR", template_specific=True,
            label="All core C4+ADR sections present",
            passed=len(missing) == 0,
            message=(
                f"Missing sections: {', '.join(missing)}"
                if missing else "All core C4+ADR sections present."
            ),
        ))

        # STR-C02: Team Topologies types named for each container
        has_tt = re.search(
            r"\b(stream.aligned|platform team|enabling team|complicated.subsystem)\b",
            full_text, re.IGNORECASE,
        )
        checks.append(StrictCheck(
            id="STR-C02", tier="STR", template_specific=True,
            label="Team Topologies types named for owning teams",
            passed=bool(has_tt),
            message=(
                "No Team Topologies classification found — each container should name its owning team type."
                if not has_tt else "Team Topologies types referenced."
            ),
        ))

        # STR-C03: ADR statuses are "Accepted" (C4+ADR is post-decision)
        wrong_status = [a.id for a in doc.adrs if a.status.lower() not in ("accepted", "superseded")]
        checks.append(StrictCheck(
            id="STR-C03", tier="STR", template_specific=True,
            label='ADR statuses are "Accepted" (C4+ADR is post-decision)',
            passed=len(wrong_status) == 0,
            message=(
                f"ADRs with non-Accepted status: {', '.join(wrong_status)}"
                if wrong_status else "All ADRs have Accepted status."
            ),
        ))

        # SEM-C01: Fitness functions per quality attribute
        has_fitness = re.search(
            r"\b(fitness function|verified by|automated verification|slo monitor|load test)\b",
            full_text, re.IGNORECASE,
        )
        checks.append(StrictCheck(
            id="SEM-C01", tier="SEM", template_specific=True,
            label="Fitness functions named for quality attributes",
            passed=bool(has_fitness),
            message=(
                "No fitness functions found — each quality attribute needs automated verification."
                if not has_fitness else "Fitness functions referenced."
            ),
        ))

        # SEM-C02: Evolutionary lens — ADRs mention reversibility
        reversibility_adrs = [
            a.id for a in doc.adrs
            if not re.search(r"\b(revers|irrevers|lock.in|exit strategy|constrain)\b",
                             a.context + " " + " ".join(a.consequences_negative),
                             re.IGNORECASE)
        ]
        pct_covered = 1 - len(reversibility_adrs) / max(len(doc.adrs), 1)
        checks.append(StrictCheck(
            id="SEM-C02", tier="SEM", template_specific=True,
            label="≥ 50% of ADRs address reversibility / lock-in",
            passed=pct_covered >= 0.5,
            message=(
                f"Reversibility not addressed in: {', '.join(reversibility_adrs[:4])}"
                if pct_covered < 0.5
                else f"Reversibility addressed in {round(pct_covered*100)}% of ADRs."
            ),
        ))

        # SEM-C03: Conway's Law — container ownership stated
        has_conway = re.search(r"\b(conway|owned by|owning team|team boundary)\b", full_text, re.IGNORECASE)
        checks.append(StrictCheck(
            id="SEM-C03", tier="SEM", template_specific=True,
            label="Conway's Law / container ownership explicitly stated",
            passed=bool(has_conway),
            message=(
                "No Conway's Law or team ownership found in container descriptions."
                if not has_conway else "Conway's Law / team ownership referenced."
            ),
        ))

        return checks

    # ── RFC-specific ──────────────────────────────────────────────────────

    def _rfc_checks(self, doc: "HLDDocument", full_text: str, titles: list[str]) -> list[StrictCheck]:
        checks = []

        def has_section(keywords: tuple) -> bool:
            return any(kw.lower() in t for t in titles for kw in keywords)

        # STR-R01: All required RFC sections present
        missing = [
            name for name, kws in RFC_REQUIRED_SECTION_KEYWORDS.items()
            if not has_section(kws)
        ]
        checks.append(StrictCheck(
            id="STR-R01", tier="STR", template_specific=True,
            label="All core RFC sections present (TL;DR, Goals, Design, Alternatives, Rollout)",
            passed=len(missing) == 0,
            message=(
                f"Missing sections: {', '.join(missing)}"
                if missing else "All core RFC sections present."
            ),
        ))

        # STR-R02: ADR statuses are "Proposed" (RFC is pre-implementation)
        wrong_status = [
            a.id for a in doc.adrs
            if a.status.lower() not in ("proposed", "draft")
        ]
        checks.append(StrictCheck(
            id="STR-R02", tier="STR", template_specific=True,
            label='ADR statuses are "Proposed" (RFC is pre-implementation)',
            passed=len(wrong_status) == 0,
            message=(
                f"ADRs with non-Proposed status: {', '.join(wrong_status)} — RFC decisions should be Proposed, not Accepted."
                if wrong_status else "All ADRs correctly marked Proposed."
            ),
        ))

        # STR-R03: Alternatives section has ≥ 3 alternatives (including status quo)
        alt_section = next(
            (s for s in doc.sections if re.search(r"\balternative|\bconsidered\b", s.title, re.IGNORECASE)),
            None,
        )
        alt_count = len(re.findall(r"(?i)(option\s+\d|alternative\s+\d|\*\*\s*\w+|\n#{1,3}\s+\w)", alt_section.content if alt_section else ""))
        has_status_quo = alt_section and re.search(
            r"\b(status quo|do nothing|current state|no change|not build)\b",
            alt_section.content, re.IGNORECASE,
        )
        checks.append(StrictCheck(
            id="STR-R03", tier="STR", template_specific=True,
            label="Alternatives section includes 'Status quo / Do Nothing' option",
            passed=bool(has_status_quo),
            message=(
                "Alternatives section missing 'Status quo / Do Nothing' — every RFC must justify itself against not building."
                if not has_status_quo else "'Status quo' alternative present."
            ),
        ))

        # STR-R04: Rollout strategy named (Strangler Fig / Feature Flag / Blue-Green / Dark Launch)
        has_rollout_strategy = re.search(
            r"\b(strangler fig|feature flag|blue.green|dark launch|canary|big bang|parallel run)\b",
            full_text, re.IGNORECASE,
        )
        checks.append(StrictCheck(
            id="STR-R04", tier="STR", template_specific=True,
            label="Named rollout strategy (Strangler Fig / Feature Flag / Blue-Green / etc.)",
            passed=bool(has_rollout_strategy),
            message=(
                "No named rollout strategy found — RFC §9 must name the migration/rollout pattern."
                if not has_rollout_strategy else "Named rollout strategy present."
            ),
        ))

        # SEM-R01: Non-Goals have reasons (not just a list)
        goals_section = next(
            (s for s in doc.sections if re.search(r"\bgoal\b", s.title, re.IGNORECASE)), None,
        )
        has_nongole_reasons = goals_section and re.search(
            r"non.goal.{0,200}(because|since|out of scope|excluded|deferred|future)",
            goals_section.content, re.IGNORECASE | re.DOTALL,
        )
        checks.append(StrictCheck(
            id="SEM-R01", tier="SEM", template_specific=True,
            label="Non-Goals include reasons for exclusion",
            passed=bool(has_nongole_reasons),
            message=(
                "Non-Goals listed without reasons — each non-goal should explain why it is excluded."
                if not has_nongole_reasons else "Non-Goals include justifications for exclusion."
            ),
        ))

        # SEM-R02: TL;DR section is concise (≤ 400 chars — forced brevity)
        tldr_section = next(
            (s for s in doc.sections if re.search(r"\btl.?dr\b|summary|executive", s.title, re.IGNORECASE)),
            None,
        )
        tldr_len = len(tldr_section.content.strip()) if tldr_section else 0
        checks.append(StrictCheck(
            id="SEM-R02", tier="SEM", template_specific=True,
            label="TL;DR is concise (≤ 600 chars — 3 sentences max)",
            passed=0 < tldr_len <= 600,
            message=(
                f"TL;DR is {'missing' if tldr_len == 0 else f'too long ({tldr_len} chars) — should be ≤ 600'}."
                if not (0 < tldr_len <= 600) else f"TL;DR is concise ({tldr_len} chars)."
            ),
        ))

        # SEM-R03: Success metrics are measurable in the rollout/cross-cutting section
        has_success_metrics = re.search(
            r"\b(success metric|kpi|acceptance criteri|measured by|verified by)\b",
            full_text, re.IGNORECASE,
        )
        checks.append(StrictCheck(
            id="SEM-R03", tier="SEM", template_specific=True,
            label="Success metrics / acceptance criteria defined",
            passed=bool(has_success_metrics),
            message=(
                "No success metrics or acceptance criteria found."
                if not has_success_metrics else "Success metrics / acceptance criteria defined."
            ),
        ))

        return checks
