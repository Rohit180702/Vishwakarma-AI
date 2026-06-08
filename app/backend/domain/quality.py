"""
Programmatic guardrail validator for generated HLD documents.

Two severity tiers:
  CRIT-*  — critical failures that trigger a one-shot retry before returning
  HIGH-*  — quality warnings surfaced to the user but no retry

Rule IDs map 1-to-1 with the GUARDRAILS section in every system prompt,
so a failing check can cite the exact rule the LLM was instructed to follow.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from domain.models import HLDDocument, HLDQualityReport, QualityCheck

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Matches a numeric NFR target: "200ms", "99.9%", "1,000 RPS", "2 GB/s", etc.
# Anchored to meaningful performance / reliability units only.
_MEASURABLE_RE = re.compile(
    r"\d[\d,\s]*\s*(ms|rps|rpm|req/s|requests?/s|%\s*(availability|uptime|error|slo)|"
    r"tps|transactions?/s|latency|throughput)",
    re.IGNORECASE,
)

# Fitness function signal: intent-level keywords only — no specific tool names
# to avoid tech bias. Any automated verification language qualifies.
_FITNESS_KW = frozenset([
    "verified by",
    "fitness function",
    "automated verification",
    "automated check",
    "automated test",
    "continuous verification",
    "slo monitor",
    "load test",
    "synthetic monitor",
])

# Conway's Law signal: structural/ownership language, not specific frameworks
_CONWAY_KW = frozenset([
    "conway",
    "team ownership",
    "owned by",
    "owning team",
    "team boundary",
    "team structure",
    "team owns",
    "team topology",
])

# Raw prompt placeholders that should never appear in output
_LEAK_TOKENS = ["{raw_text}", "{sections_str}", "{template_text}"]

# IDs whose failure triggers a retry
CRITICAL_IDS = frozenset(["CRIT-001", "CRIT-002", "CRIT-003", "CRIT-004"])

# Minimum characters for a section to be considered substantive.
# Rationale: a single meaningful sentence in English averages ~80–120 characters.
# A section below this threshold is either empty or contains only a heading echo.
_MIN_SECTION_CHARS = 100


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

class HLDQualityValidator:
    """
    Validates a generated HLDDocument against 10 structural and quality rules.
    Call .validate() → HLDQualityReport.
    """

    def validate(self, doc: "HLDDocument") -> "HLDQualityReport":
        # Import here to avoid circular imports
        from domain.models import HLDQualityReport, QualityCheck

        checks: list[QualityCheck] = [
            self._check_min_sections(doc),
            self._check_section_content(doc),
            self._check_min_adrs(doc),
            self._check_min_diagrams(doc),
            self._check_adr_alternatives(doc),
            self._check_adr_negative_consequences(doc),
            self._check_measurable_nfrs(doc),
            self._check_fitness_functions(doc),
            self._check_conways_law(doc),
            self._check_no_prompt_leaks(doc),
        ]

        critical_failed = any(not c.passed for c in checks if c.id in CRITICAL_IDS)
        passed_count = sum(1 for c in checks if c.passed)
        score = round((passed_count / len(checks)) * 100)

        return HLDQualityReport(
            passed=all(c.passed for c in checks),
            score=score,
            checks=checks,
            should_retry=critical_failed,
        )

    # ------------------------------------------------------------------ CRIT

    def _check_min_sections(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        n = len(doc.sections)
        ok = n >= 3
        return QualityCheck(
            id="CRIT-001",
            label="Minimum sections present",
            passed=ok,
            message=(
                f"Only {n} section(s) generated — minimum required is 3."
                if not ok else f"{n} sections present."
            ),
        )

    def _check_section_content(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        thin = [s.title for s in doc.sections if len(s.content.strip()) < _MIN_SECTION_CHARS]
        ok = len(thin) == 0
        return QualityCheck(
            id="CRIT-002",
            label="Section content depth",
            passed=ok,
            message=(
                f"Thin or empty content (<100 chars) in: {', '.join(thin)}."
                if not ok else "All sections have substantive content."
            ),
        )

    def _check_min_adrs(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        n = len(doc.adrs)
        ok = n >= 3
        return QualityCheck(
            id="CRIT-003",
            label="Minimum ADRs present",
            passed=ok,
            message=(
                f"Only {n} ADR(s) generated — minimum required is 3."
                if not ok else f"{n} ADRs present."
            ),
        )

    def _check_min_diagrams(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        n = len(doc.diagrams)
        ok = n >= 1
        return QualityCheck(
            id="CRIT-004",
            label="C4 diagrams present",
            passed=ok,
            message=(
                "No C4 diagrams generated."
                if not ok else f"{n} diagram(s) generated."
            ),
        )

    # ------------------------------------------------------------------ HIGH

    def _check_adr_alternatives(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        missing = [a.id for a in doc.adrs if len(a.alternatives) == 0]
        ok = len(missing) == 0
        return QualityCheck(
            id="HIGH-001",
            label="ADR alternatives documented",
            passed=ok,
            message=(
                f"ADRs missing alternatives: {', '.join(missing)}."
                if not ok else "All ADRs document considered alternatives."
            ),
        )

    def _check_adr_negative_consequences(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        missing = [a.id for a in doc.adrs if len(a.consequences_negative) == 0]
        ok = len(missing) == 0
        return QualityCheck(
            id="HIGH-002",
            label="ADR trade-offs documented",
            passed=ok,
            message=(
                f"ADRs missing negative consequences: {', '.join(missing)}."
                if not ok else "All ADRs document accepted trade-offs."
            ),
        )

    def _check_measurable_nfrs(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        full_text = " ".join(s.content for s in doc.sections)
        ok = bool(_MEASURABLE_RE.search(full_text))
        return QualityCheck(
            id="HIGH-003",
            label="Measurable NFR targets present",
            passed=ok,
            message=(
                "No measurable NFR targets found — expected patterns like 'p99 < 200ms at 1,000 RPS'."
                if not ok else "At least one measurable NFR target present."
            ),
        )

    def _check_fitness_functions(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        full_text = " ".join(s.content for s in doc.sections).lower()
        ok = any(kw in full_text for kw in _FITNESS_KW)
        return QualityCheck(
            id="HIGH-004",
            label="Fitness function verification referenced",
            passed=ok,
            message=(
                "No fitness function or automated verification found in any section."
                if not ok else "Automated fitness function verification referenced."
            ),
        )

    def _check_conways_law(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        full_text = " ".join(s.content for s in doc.sections).lower()
        ok = any(kw in full_text for kw in _CONWAY_KW)
        return QualityCheck(
            id="HIGH-005",
            label="Conway's Law / team ownership applied",
            passed=ok,
            message=(
                "No team ownership or Conway's Law analysis found."
                if not ok else "Team ownership / Conway's Law referenced."
            ),
        )

    def _check_no_prompt_leaks(self, doc: "HLDDocument") -> "QualityCheck":
        from domain.models import QualityCheck
        corpus = " ".join(
            [doc.project_name]
            + [s.content for s in doc.sections]
            + [a.context + " " + a.decision for a in doc.adrs]
        )
        found = [t for t in _LEAK_TOKENS if t in corpus]
        ok = len(found) == 0
        return QualityCheck(
            id="HIGH-006",
            label="No unrendered prompt placeholders",
            passed=ok,
            message=(
                f"Prompt placeholders found in output: {', '.join(found)}."
                if not ok else "No unrendered prompt placeholders."
            ),
        )
