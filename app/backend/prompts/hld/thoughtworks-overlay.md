# ThoughtWorks Enrichment Overlay

> **This overlay augments the base template above.** It adds ThoughtWorks engineering principles
> on top of the standard requirements. Every base-template rule still applies. This overlay
> specifies *additional* content — not replacement content.

---

## Overlay Philosophy

ThoughtWorks has published widely-cited practices through *Evolutionary Architecture* (Ford,
Parsons, Kua), *Team Topologies* (Skelton & Pais), *Refactoring* (Fowler), and the
*ThoughtWorks Technology Radar*. These practices extend standard documentation with a focus on
changeability, team cognitive load, and automated fitness functions.

Apply these additions with the same "just enough" principle: if a concept is N/A for this system,
say so in one sentence and omit the deep discussion.

**Template mapping:** The section references below (§1.2, §4, §5, etc.) use arc42 numbering as
an anchor. Apply the concept to the **equivalent section in the active template**:

| arc42 section | c4-adr equivalent | RFC / Design Doc equivalent |
|---|---|---|
| §1.2 Quality Goals | System Overview — quality attributes | Goals (Section 3) + Success Metrics (Section 8) |
| §4 Solution Strategy | System Overview — decomposition rationale | Technical Design (Section 4) |
| §5 Building Block View | Container Diagram section (Section 3) | Technical Design — key components |
| §8 Crosscutting Concepts | Risks and Open Questions + inline in Container section | Cross-Cutting Concerns (Section 6) |
| §9 Architecture Decisions | ADRs (Section 5) | ADRs (embedded in the adrs array) |
| §10 Quality Requirements | System Overview quality attributes | Success Metrics (Section 8) |
| §11 Risks and Technical Debt | Risks and Open Questions (Section 6) | Open Questions and Risks (Section 7) |

---

## Section-by-Section Augmentations

### Augment §1.2 — Quality Goals

**Evolutionary Lens column (additional):** Extend the quality goals table with a third column:
`Evolutionary lens`. For each quality attribute, state whether it enables or constrains future
change — and what automated fitness function will verify this attribute remains satisfied after
each deployment.

Format:
| Priority | Quality Goal (measurable) | Evolutionary Lens — fitness function |
|---|---|---|
| 1 | P99 latency < 200 ms at 1,000 RPS | Latency budget: Datadog SLO alert if 7-day p99 > 150 ms |
| 2 | Availability 99.9% monthly | Error-budget burn alert at 5% daily burn rate |

*A quality attribute with no automated verification is a wish, not an engineering commitment.*
Include this statement in the section if a quality goal lacks automation.

### Augment §2 — Architecture Constraints

**Technology Radar alignment (additional):** For every major technology chosen, note its current
ThoughtWorks Technology Radar status if known: Adopt / Trial / Assess / Hold. Flag any Hold-status
technology chosen under organisational constraint — state what the exit strategy is and when it
would be revisited.

### Augment §4 — Solution Strategy

**Evolutionary Architecture Principles (additional):** After the quality goal traceability table,
add an explicit section:

> **Architecture Principles**
> A principle is an actionable constraint, not a goal. Each principle governs trade-off decisions
> when competing forces arise.

Format:
| Principle | Rationale | Trade-off it governs |
|---|---|---|
| Prefer loose coupling over cohesion at service boundary | Enables independent deployability | Accept more boilerplate/mapping at service edges |
| Fitness functions are first-class requirements | Prevents quality-attribute erosion over time | Adds CI pipeline complexity |

Minimum two principles derived from the quality goals in §1.2. Principles must be specific enough
to guide a real trade-off — "keep it simple" is not a principle.

**Monolith-First challenge (additional):** If the spec describes an early-stage product or a
small team (fewer than three stream-aligned teams), add a challenge note:

> ⚠️ **Monolith-First challenge:** A well-structured monolith or modular monolith is the correct
> starting point for early-stage products. Premature decomposition into microservices creates
> operational overhead and coupling problems that kill velocity. State the decomposition
> prerequisite explicitly: "We will extract [Service X] when [team boundary | scaling bottleneck |
> deployment independence need] is reached." If microservices are chosen now, justify against
> team scale, bounded contexts, and operational maturity.

**DDD Bounded Contexts (additional):** Identify the major bounded contexts — the logical areas
where a consistent domain model applies. If the spec uses the same term with different meanings
in different parts of the system (e.g., "User" in billing vs. auth), name each context and
disambiguate. Building block boundaries in §5 should align with bounded context boundaries.

### Augment §5 — Building Block View

**Team ownership (additional — Conway's Law):** Add a `Team` column to every building-block
table. State which team owns and operates each block. Apply Conway's Law deliberately:
decomposition decisions should reflect team communication structure. Flag any block not aligned
to a team boundary as an architectural risk.

**Team Topologies classification (additional):** For every owning team, identify its type:
- **Stream-aligned** — owns a value stream end-to-end; the normal mode of delivery.
- **Platform** — provides X-as-a-Service to stream-aligned teams; the block should have a
  self-service consumption model.
- **Enabling** — temporarily helps a stream-aligned team acquire a capability; if this becomes
  permanent, call it out as a Team Topologies smell.
- **Complicated-subsystem** — requires specialist knowledge (e.g., ML pipeline, cryptography
  service, regulatory rules engine).

Format: "Owned by: [Team name] ([TT type])"

If multiple teams own a single block, flag it as a Team Topologies anti-pattern (shared ownership
creates coordination overhead and unclear accountability).

**DDD alignment (additional):** State which Bounded Context each Level 1 block belongs to. If a
block straddles contexts, flag it as an architectural risk.

### Augment §6 — Runtime View

**Evolutionary resilience (additional):** For the failure-and-recovery scenario, explicitly
note the *fitness function* that will detect the failure in production:
> "Failure detected by: [monitoring mechanism] — alert fires within [N seconds/minutes]. SLO
> impact if not recovered within [X minutes]: [Y% of monthly error budget consumed]."

### Augment §8 — Crosscutting Concepts

**Testing Strategy (mandatory in TW mode):** Add a dedicated Testing Strategy subsection:

- **Test pyramid:** State the proportion of unit / integration / end-to-end tests and the
  tooling for each layer. Every building block from §5 must have a stated testing owner.
- **Test data strategy:** How test data is created, isolated between tests, and cleaned up.
  Flag any test suite that shares production data.
- **Contract tests:** If the system exposes or consumes an API shared with another team or
  external party, name the contract testing tool and where the contracts live in version control.
- **Coverage expectation:** A per-layer coverage target with units. "100% coverage" without
  qualification is not a target — state what coverage measures (branch, line, mutation).

**Fitness Functions (mandatory in TW mode):** Add a dedicated Fitness Functions subsection:

Fitness functions are automated verifications that enforce architectural properties continuously,
applied at CI/CD time or as ongoing monitors.

| Quality attribute | Fitness function | Tool / trigger | Alert threshold |
|---|---|---|---|
| [From §1.2] | [What is measured] | [How/when it runs] | [Number + units] |

Minimum one fitness function per quality goal from §1.2. A quality attribute with no fitness
function is an aspirational goal, not an architectural requirement.

**CI Quality Gate Policy (mandatory in TW mode):** Add a subsection:

> **CI quality gate policy:** No merge to main without: (a) all unit tests green, (b) no new
> critical or high security findings in SAST scan, (c) no regression on quality-attribute
> thresholds measured by fitness functions above. State the tool for each gate.

### Augment §9 — Architecture Decisions

**Evolutionary Architecture Lens (additional):** For every ADR in the `adrs` array, add a note
to `consequences_negative` if the decision creates irreversibility:
> "Constraint on future change: [specific decomposition or migration risk]. Mitigated by: [exit strategy or reversibility condition]."

ADRs for irreversible decisions must have proportionally more evidence in the `context` field.

**Alternatives quality check:** The alternatives section is the most important part of an ADR
(ThoughtWorks Lightweight ADR standard). Strawman alternatives that were never seriously
considered undermine the record. Every alternative must have been a genuine candidate — state
why it was ultimately rejected with 2–3 precise, specific reasons.

### Augment §10 — Quality Requirements

**Fitness function mapping (additional):** Extend each quality scenario with a `Verification`
field:
- **Verification:** How the response measure is continuously checked in CI/production. Name the
  specific tool, the pipeline stage, and the alert mechanism.

Example:
> Scenario: Peak-load latency.
> ...standard SEI fields...
> **Verification:** k6 load test in CI (`ci/k6/peak-load.js`). Fails build if p99 > 180 ms.
> Datadog SLO monitor ID `slo-api-latency` pages on-call at 5% burn rate over 1 hour.

### Augment §11 — Risks and Technical Debt

**Fowler's Technical Debt Quadrant (additional):** For each debt item, classify it using
Fowler's quadrant:

| Debt item | Quadrant | Rationale for classification |
|---|---|---|
| [Item] | Reckless–Deliberate / Reckless–Inadvertent / Prudent–Deliberate / Prudent–Inadvertent | [Why] |

- **Prudent–Deliberate:** "We know it's not ideal, we chose speed now." Acceptable if there is
  a clear paydown plan.
- **Prudent–Inadvertent:** Discovered after the fact; schedule paydown immediately.
- **Reckless–Deliberate:** "We don't have time for good design." Flag as a team process concern.
- **Reckless–Inadvertent:** Indicates a skills or knowledge gap; needs a learning plan, not just
  a backlog item.

---

## Additional Checklist Items (TW mode only)

Append these checks to the standard self-evaluation checklist before generating the JSON:

| Check | Pass condition |
|---|---|
| TW1 Fitness functions | Every quality goal has a named automated fitness function in §8 |
| TW2 Team Topologies | Every §5 building block states owning team + Team Topologies type |
| TW3 Architecture Principles | §4 contains an explicit principles table (minimum two principles) |
| TW4 Testing strategy | §8 Testing Strategy covers pyramid, tooling, coverage, and test data |
| TW5 CI gate policy | §8 CI Quality Gate Policy names the tool for every gate |
| TW6 Evolutionary lens | §1.2 quality goals table includes an Evolutionary Lens column |
| TW7 ADR irreversibility | Every ADR with irreversible consequences notes the constraint and exit strategy |
| TW8 DDD bounded contexts | §4 identifies major bounded contexts; §5 aligns blocks to contexts |
| TW9 Fowler TD Quadrant | §11 debt items are classified by Fowler's quadrant |
| TW10 Monolith-First | §4 addresses the Monolith-First challenge for early-stage systems |
