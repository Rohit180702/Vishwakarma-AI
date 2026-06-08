# Architectural Decision Making — ADRs, Lightweight ADRs & the Advice Process

> Everything about how architectural decisions are made, recorded, and stored — in one place.

---

## The Big Picture

There are three connected ideas here. They work as a sequence:

```
Advice Process  →  decision is made  →  documented as an ADR  →  stored as a Lightweight ADR file
(how you decide)    (the outcome)        (what you write down)     (how you store it)
```

---

## Part 1 — Architecture Advice Process

### The Problem

In most companies, architectural decisions go through a committee or a Principal Architect who approves everything. This creates two problems:

1. **Speed** — teams wait weeks for approvals on decisions they need to make today
2. **Quality** — the people farthest from the problem (the committee) are making the calls, while the people closest to it (the developers) have no say

The State of DevOps report confirmed this: traditional Architecture Review Boards **correlate with low organisational performance**.

### The Rule

> **Anyone can make an architectural decision.**
> But before they decide, they must seek advice from:
> 1. People who will be **affected** by the decision
> 2. People with **expertise** in the area

You don't ask for permission. You ask for advice. Then you make the call.

### A Simple Example

A backend developer wants to switch from REST to GraphQL.

**Old way:** Submit a proposal → wait for the architecture board meeting → present → defend → maybe get approved.

**Advice Process way:**
- Talk to the frontend team (they're affected — their queries change)
- Talk to the DevOps team (they're affected — new tooling, observability)
- Talk to someone with GraphQL experience (expertise)
- Consider their input seriously
- Make the decision and document it as an ADR

The developer decides. No committee needed.

| Old Model | Advice Process |
|---|---|
| Ask for permission | Ask for advice |
| Committee decides | Decision-maker decides |
| Slow, centralised | Fast, distributed |
| Team feels policed | Team feels trusted |

*Source: [Thoughtworks Tech Radar Vol 32, April 2025](https://www.thoughtworks.com/radar/techniques/architecture-advice-process)*

---

## Part 2 — Architecture Decision Record (ADR)

### What It Is

An ADR is just a short document that answers the question: **"Why is the system built this way?"**

Imagine joining a project 6 months after it was built. You see Kafka being used between two services. You wonder — why not a REST call? No one remembers. The person who decided has left. You spend days figuring it out, or worse — you undo it and break something.

An ADR prevents that.

It also serves a second purpose: **writing forces disagreement to the surface.** You can argue verbally for weeks without resolving a decision. The moment someone sits down to write "We will use X because…" — the disagreement becomes concrete and must be resolved.

### The Format Rules (Martin Fowler's Definition)

**Noun-phrase title — a label, not a sentence**
```
✅  Use Kafka for event streaming
❌  We decided to use Kafka
```

**Active voice decision — clear ownership**
```
✅  We will use PostgreSQL as the primary database.
❌  PostgreSQL was selected.
```

**List every serious alternative with pros AND cons**

Not just "we considered MySQL." Write out both sides for every option. This is the most valuable part — it proves the decision was actually thought through.

**Split consequences into positives and negatives — separately**

- **Benefits:** services are decoupled, failures are isolated
- **Trade-offs:** adds operational complexity, higher learning curve

Separating them forces honesty. You can't hide trade-offs inside a vague "consequences" paragraph.

**Never modify an accepted ADR — supersede it**

Once accepted, an ADR is frozen. It becomes a historical fact. If you change your mind, write a new ADR and mark the old one as "Superseded by ADR-007." The old one stays — you can always trace the full journey.

**One page maximum**

If you can't explain the decision and its trade-offs in one page, you haven't understood the decision well enough yet.

*Source: [Martin Fowler — ArchitectureDecisionRecord](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)*

---

## Part 3 — Lightweight ADR (How to Store It)

### Why "Lightweight"?

Traditional ADRs in large enterprises can be 5–10 page documents with formal approval workflows, cost-benefit matrices, and sign-offs.

**Lightweight ADR** strips all that away. Thoughtworks' principle:

> "The value is in the *decision being recorded*, not the *ceremony around it*."

Write it in 15 minutes. Commit it alongside your code change. Done.

### The Three Golden Rules

**1. One decision = one file**

```
docs/adr/
  0001-use-kafka-for-events.md
  0002-use-postgres-as-primary-db.md
  0003-adopt-hexagonal-architecture.md
```

**2. Once accepted, never edit it**

If you change your mind, create a new ADR and mark the old one as Superseded.

```markdown
# ADR-005: Replace Kafka with AWS SQS

**Status:** Accepted
**Supersedes:** ADR-001

## Context
We moved to a fully serverless stack. Running a Kafka cluster is now too expensive.
```

**3. Store it with the code**

Not in Confluence, not in Notion, not in email. In the repo — so when someone clones it, the decisions come with it.

### Status Values

| Status | Meaning |
|---|---|
| **Proposed** | Under discussion, not yet decided |
| **Accepted** | Decision is made, in effect |
| **Superseded** | Was accepted, now replaced by a newer ADR |
| **Deprecated** | No longer relevant but not replaced |

### What Counts as an ADR-worthy Decision?

Write one when:
- The decision is **hard to reverse** (database choice, event bus, auth strategy)
- Someone will **definitely question it** in the future
- You **considered multiple options** and need to record why you picked one
- It has **significant trade-offs** the team accepted consciously

You don't need an ADR for: naming a variable, choosing a colour, or picking a library with no real alternatives.

*Source: [Thoughtworks Tech Radar: Lightweight ADRs](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)*

---

## A Complete Example

```markdown
# ADR-003: Use PostgreSQL as the Primary Database

**Status:** Accepted

## Context
The system needs a relational store for transactional data. Evaluated three options
under constraints of: row-level security, JSON document storage, and team expertise.

## Decision
We will use PostgreSQL 16 as the primary database.

## Alternatives Considered

**MySQL 8**
- Pros: simpler operations, wider hosting support
- Cons: no row-level security, limited JSON support

**MongoDB**
- Pros: flexible schema, native JSON
- Cons: no ACID transactions across documents, team has no expertise

**PostgreSQL** ← chosen
- Pros: row-level security, native JSONB, ACID, proven at scale
- Cons: heavier operational overhead than MySQL

## Benefits
- Row-level security meets compliance requirements without application-layer workarounds
- JSONB columns allow flexible metadata storage without a separate document store

## Trade-offs
- Requires more DBA expertise to tune at scale
- Slightly higher operational complexity than MySQL
```

---

## How This Connects to Vishwakarma AI

Our tool doesn't implement the Advice Process — that's a human conversation. But we generate the ADR that would normally come out of it.

| Practice | Our Implementation |
|---|---|
| Alternatives with pros/cons | `alternatives[]` — each has `pros[]` and `cons[]` |
| Split consequences | `consequences_positive[]` and `consequences_negative[]` |
| Status: Accepted / Superseded | `status` field on every ADR |
| Active voice decisions | Embedded instruction in every system prompt |
| Store in `doc/adr/` | Hint shown at the top of the ADR tab |
| Download as `.md` | Download button in ADR tab |

The ADRs we generate are educated guesses based on the specification. In a real project, a team would run the Advice Process first — consult affected people, weigh options — then use our output as a starting draft to refine and commit.

**The tool lowers the cost of the write-up — so teams are more likely to actually do it.**

---

## Further Reading

- [Documenting Architecture Decisions — Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — the original post that started ADRs
- [Thoughtworks Tech Radar: Lightweight ADRs](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records) — Thoughtworks' Adopt recommendation
- [Architecture Advice Process — Thoughtworks Tech Radar Vol 32](https://www.thoughtworks.com/radar/techniques/architecture-advice-process) — current TW position (Trial, April 2025)
- [Martin Fowler on ADRs](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) — canonical format definition
- [MADR format](https://adr.github.io/madr/) — the structured ADR template Vishwakarma AI uses
- [adr-tools CLI](https://github.com/npryce/adr-tools) — command-line tool to manage ADR files in a repo
