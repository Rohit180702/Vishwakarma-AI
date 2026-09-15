# Vishwakarma

> *From requirements that get interpreted — to requirements that get interrogated.*

**A Requirements Enrichment Platform — one ambiguous requirements document in, one standards-backed Enriched Requirements Document (ERD) out. Technical track for architects today. Functional track for business analysts in Phase 2. One interrogation. Two consistent delivery artifacts. Your entire delivery team covered from a single source of truth.**

*[Setup Guide](SETUP.md) · [Report Issues](https://github.com/Rohit180702/Vishwakarma-AI/issues)*

## Quick Start

Full setup in **[SETUP.md](SETUP.md)**.

```bash
# 1. Start the database layer
docker compose up -d

# 2. Configure and start the backend
cd app/backend && pip install -e .
# Add ANTHROPIC_API_KEY to .env
cd .. && ./start-backend.sh

# 3. Start the frontend
cd app/frontend && npm install && npm run dev

# → http://localhost:5173
```

> **Built on the AI/Works lifecycle.** We started with the [AI/Works technical guide](https://www.thoughtworks.com/ai/works/technical-guide) and every component, diagram, and roadmap stage on the platform microsite. Stage one of the lifecycle names *Requirements Capture and Enrichment* — but does not supply the governance layer, document standards, or human sign-off workflow that make enriched requirements trustworthy before they feed Dynamic Spec. Vishwakarma builds exactly that layer.

---

## Quick Summary

### The Problem

The AI/Works lifecycle defines Requirements Capture and Enrichment as stage one — *"structuring requirements so they can be enriched and executed by the platform."* What it does not define is how: no document standard, no decision record, no structured sign-off before raw client requirements feed into Dynamic Spec and downstream agents. Ambiguous requirements don't fail at requirements time — they fail months later, in UAT or production, once the architectural options have narrowed and the cost has compounded.

#### The Industry Evidence

| Finding | Source |
|---|---|
| **47%** of unsuccessful projects fail to meet goals due to inaccurate requirements management | PMI — Pulse of the Profession |
| Requirements defects cost up to **100×** more to fix in production than at definition | IBM Systems Sciences Institute |
| Incomplete requirements — the **#1 factor** in impaired projects | Standish Group — CHAOS Report |

### The Solution

Upload the document. Choose the track — Technical, Functional, or Both. Vishwakarma runs it through four stages:

1. **Enrich** — every architecture characteristic surfaced with a confidence score and the exact source sentence that implies it. The architect confirms and ranks them. An architecture interview resolves every open decision — each option scored against the confirmed priorities. Every choice lands in an append-only **Decision Ledger**.
2. **Generate** — the complete **ERD-Technical** (arc42 v9 · C4+ADR · RFC) streamed live, grounded in the characteristics and decisions recorded above. The **ERD-Functional** (BRD · FRD · User Story Map) follows the same pipeline for business analysts. *(Phase 2)*
3. **Visualise** — ask the architecture any question in plain English. The platform surfaces the answer step by step — each hop highlighting the component, the protocol, and the handoff. Step through it manually or enable simulation and watch the full flow animate across the live C4 diagram. This is how you run a stakeholder design review, onboard a new engineer, or walk a client through a scenario — directly from the generated architecture, no preparation required.
4. **Sign off** — GitHub-style inline comments anchored to specific sections, version history, and structured approval by both business and technical reviewers before any design is committed or code is written.

One pipeline. Two role-appropriate delivery artifacts. Every prompt rule, schema field, and generated document section enforces a named Thoughtworks engineering principle — ADRs, Architecture Advice Process, Evolutionary Architecture, DDD, Conway's Law, C4 Model, OpenTelemetry. See [Section 4](#4-innovation--novelty) for the full breakdown.

### The Impact

| | Today | With Vishwakarma |
|---|---|---|
| Traceable architecture artifact | Weeks of workshops and authoring | A single focused session |
| Decision rationale | Email threads and tribal knowledge | Decision Ledger — every choice, alternative, and trade-off recorded |
| Review cycle | Weeks per email-and-revise round | Inline comments → versioned approval, same session |
| Documentation standard | Whatever the author knows | arc42 v9 · C4 · ADR — enforced by the engine |

### AI/Works Integration

**Requirements Capture and Enrichment** is stage one of the [AI/Works delivery lifecycle](https://www.thoughtworks.com/ai/works/technical-guide). Vishwakarma is purpose-built for that stage. Instead of Dynamic Spec inheriting raw client documents with every ambiguity intact, what reaches it is a structured, validated, approved ERD — every quality attribute ranked, every decision recorded, signed off by both business and technical users.

The vision extends further: if the generated Super Spec were run back through the same pipeline — compared against the signed-off ERD — you would have end-to-end validation before and after generation, by the same users who approved the requirements. That is the story we are proposing for how AI/Works could close the loop. We are not the owners of Dynamic Spec. See [Section 2](#2-aiworks-ecosystem-integration) for the full diagram.

> **Better input. Better spec. Better code.**

---

## Table of Contents

1. [What Vishwakarma Brings](#1-what-vishwakarma-brings)
2. [AI/Works Ecosystem Integration](#2-aiworks-ecosystem-integration)
3. [Business Impact](#3-business-impact)
4. [Innovation & Novelty](#4-innovation--novelty)
5. [Enriched Requirements Documents (ERDs)](#5-enriched-requirements-documents-erds)
6. [Platform Capabilities — What Is Built Today](#6-platform-capabilities--what-is-built-today)
7. [Responsible AI](#7-responsible-ai)
8. [Technology Stack](#8-technology-stack)
9. [Visual Walkthrough](#9-visual-walkthrough)
10. [References](#10-references)

---

## 1. What Vishwakarma Brings

**Vishwakarma is a Requirements Enrichment Platform.** Before a single architecture section is written, it reads the requirements document the way an experienced architect would — critically. It surfaces every quality attribute buried in business prose, exposes every unresolved trade-off, and walks the architect through every open decision with scored options and explicit consequences. Nothing is assumed. Nothing is glossed over.

What comes out is not a generated document. It is a structured, traceable record of architectural intent — interrogated by the engine, decided by the architect, reviewed by the team, and approved before any design is committed or any code is written.

> *"ChatGPT generates a document. Vishwakarma generates a decision."*

---

### The Capabilities That Set It Apart

---

#### 🔍 Requirements Interrogation Engine — *Detect. Cite. Rank.*

Upload a requirements document in any format — PDF, DOCX, Markdown, plain text. The Interrogation Engine scans business language for the architectural signal buried within prose. It surfaces every detectable architecture characteristic — each with:

- A **confidence score** derived from requirement density and linguistic weight
- The **exact source sentence** from the original document that implies it
- An **architectural explanation** of why the characteristic matters for this specific system

```
Security        95%  ← "All user data must comply with GDPR and be encrypted at rest"
Scalability     93%  ← "The platform must support 10,000 concurrent users at peak"
Availability    92%  ← "The service must maintain 99.9% uptime across all regions"
```

The architect reviews, adds anything the engine missed, removes false positives, and **reorders by priority**. This human-confirmed ranked list — not the AI's assumption — is the authoritative priority signal for every subsequent stage. **Nothing advances without architect confirmation.**

---

#### 🎯 Architecture Interview + Decision Ledger — *Resolve. Record. Trace.*

Questions are generated **specifically from the confirmed characteristics in priority order** — not a fixed template. A security-first system gets authentication and data isolation questions before concurrency. A scalability-first system gets the reverse. Every interview is different because every set of confirmed priorities is different.

For each decision:
- Multiple architectural approaches are surfaced, **scored against the team's confirmed priority ranking**
- The system recommends the best fit; the architect always decides
- Custom answers accepted at any step; any question can be skipped with the recommended answer preserved
- **Bulk accept** available when speed matters — all remaining recommendations committed with a single confirmation

Every selection is appended to the **Decision Ledger** — an append-only structured record of what was chosen, what alternatives were considered, and why. No assumption reaches the final document without a ledger entry.

---

#### 🎬 Live Visualisation & Presentation Mode — *See. Query. Present.*

The generated C4 diagrams — Context, Container, Component — are not static outputs. They are live, queryable, and presentation-ready from the moment they are generated.

Ask any question in plain English: *"What happens when a payment fails?"* The platform responds step by step — each component highlighted, each protocol named, each handoff shown in sequence. Step through it manually or enable simulation and watch the full flow animate across the live diagram.

This is bigger than one question. This is how you:
- Walk stakeholders through a design review without a whiteboard
- Onboard a new engineer without a slide deck
- Surface failure behaviour at design time — before a single customer is affected

Step through it, pause it, present it full-screen. The architecture doesn't just answer questions — it presents itself.

---

#### 🔁 GitHub-Style Inline Review & Approval — *The PR Model for Architecture*

**Architecture is the only engineering discipline where decisions are routinely made without a traceable record.** Code has Git. Infrastructure has Terraform state. Architecture has email threads — or nothing.

Vishwakarma brings the pull request review model to architecture documentation:

- **Inline section-level commenting** — reviewers comment on the specific section they are challenging, not the document as a whole
- **Threaded comments** — replies, resolutions, and re-openings tracked; every comment anchored to the ERD version it references
- **Structured approval lifecycle**: `Draft → Submitted for Review → In Review → Changes Requested → Approved`
- **Version tracking on every ERD** — every generation, edit, and AI-assisted revision creates a named version snapshot; versions are comparable
- **Approval stamped** with reviewer attribution, version, and timestamp
- **Change history as a first-class artifact** — AI-generated changes attributed to the model with the triggering prompt; human edits attributed to the author

An unvalidated architecture is an opinion with formatting. One click routes the document to named reviewers — versioned, tracked, awaiting verdict. The reviewer sees the diagram, the ADRs, and can query the architecture directly before signing off. Complete lineage, from first upload to final sign-off. Nobody asks "why did we build it this way" again.

---

#### ⚡ AI/Works Integration — *The Upstream Intelligence Layer*

> See [Section 2](#2-aiworks-ecosystem-integration) for the full integration diagram.

The entire enrichment pipeline — interrogated characteristics, resolved decisions, approved ERD — is structured specifically to serve as the **validated handoff contract into Dynamic Spec**. Dynamic Spec no longer inherits ambiguity. It receives architecture that has already been interrogated, decided, reviewed, and approved.

---

### The Two Delivery Artifacts — Enriched Requirements Documents (ERDs)

| Artifact | Audience | Standard | Status |
|---|---|---|---|
| **Technical ERD** | Architects, engineers | arc42 v9 · C4 + ADR · RFC · Custom | ✅ **Phase 1 — Built** |
| **Functional ERD** | Business analysts, product owners | Business-aligned · Plain English · Quality attributes as functional criteria | 🔄 **Phase 2** |

One pipeline. Two role-appropriate delivery artifacts. The misalignment that normally surfaces weeks into a project is resolved at source.

---

## 2. AI/Works Ecosystem Integration

> **Vishwakarma is the upstream intelligence layer in the AI/Works delivery chain.**

Dynamic Spec's discovery module currently consumes raw requirements documents. When those documents are ambiguous — and they almost always are — Dynamic Spec inherits every gap, every unresolved trade-off, and every unstated constraint. **The spec it generates is only as good as the requirements it received.**

Vishwakarma removes that constraint. The output of the enrichment pipeline is not a document — it is a **structured, validated, approved contract** that Dynamic Spec can consume with full confidence.

```mermaid
flowchart TD
    REQ["Requirements Document\nPDF, DOCX, Markdown, Plain Text"]
    REQ --> IE

    subgraph VISH["VISHWAKARMA - Requirements Enrichment Platform"]
        IE["Requirements Interrogation Engine\nCharacteristics detected, cited, priority-ranked by architect"]
        INT["Architecture Interview\nDecisions resolved against the confirmed priority order"]
        DL["Decision Ledger\nEvery choice recorded, why, and alternatives considered"]
        RV["Inline Review, Versioning and Approval\nERD reviewed, versioned, and approved before handoff"]
        IE --> INT --> DL --> RV
    end

    RV --> ERDT["ERD-Technical\narc42, C4 and ADR, RFC, Custom\nPhase 1 - Built"]
    RV --> ERDF["ERD-Functional\nBusiness-aligned, Plain English\nPhase 2"]

    ERDT --> HAND["Structured, Validated, Approved ERD\nThe structured handoff contract into AI/Works"]
    ERDF --> HAND

    HAND -->|"feeds structured context into"| DS

    subgraph DS["AI/WORKS - DYNAMIC SPEC - Spec Generation Engine"]
        DSI["Validated ERD received\nEvery quality attribute ranked, every decision recorded\nNo ambiguity inherited"]
    end

    DS --> EXEC["Code Generation, Agent Pipelines, Delivery Execution\nAI/Works Delivery Chain"]

    style HAND fill:#1b4332,color:#d8f3dc,stroke:#52b788,stroke-width:3px
    style EXEC fill:#1c3a5e,color:#dbeafe,stroke:#3b82f6,stroke-width:2px
```

When Dynamic Spec consumes a Vishwakarma ERD, it receives a document that has already:

- **Detected and priority-ranked** every quality attribute with source evidence from the original document
- **Resolved every open architectural decision** with rationale, alternatives, and trade-offs recorded in the Decision Ledger
- **Applied recognised documentation standards** — arc42 v9, C4 Model, ADR — enforced by the engine, not by the author's skill
- **Passed through inline review and approval** — versioned, attributed, and signed off before handoff

> **Better input. Better spec. Better code.**

---

## 3. Business Impact

**Requirements quality is a business problem, not an engineering problem.** Every ambiguous requirement, every unstated constraint, every unrecorded trade-off is a deferred cost that will surface later, at a higher price, with fewer architectural options remaining.

### Quantified Impact

| Metric | Without Vishwakarma | With Vishwakarma |
|---|---|---|
| Time to traceable architecture artifact | Weeks of workshops and authoring | A single focused session |
| Quality attribute coverage | Whatever the architect remembers | Every detectable characteristic, each with source evidence and confidence score |
| Decision traceability | Meeting notes, email threads, tribal knowledge | Decision Ledger — every choice, rationale, and alternative recorded |
| Stakeholder alignment | Multiple mental models, resolved through workshops | Single interrogated source of truth |
| Architecture review cycle | Weeks per email-and-revise cycle | Inline comments → approval → versioned sign-off — same session |
| Documentation standards | Varies by author skill and available time | arc42 v9 · C4 Model · ADR — enforced by the engine |
| ERD version and approval history | Non-existent | Full version history + approval trail committed to source control |
| Downstream AI agent quality | Constrained by raw, ambiguous input | Structured, validated, approved ERD as input |

### The Compounding Cost of Deferred Decisions

Every unresolved requirement becomes an assumption. Every assumption becomes a codebase constraint. Every constraint becomes a blocker on future change. **The cost doesn't disappear — it defers and compounds.** An architecture characteristic detected during requirements interrogation costs minutes. The same characteristic discovered during a production incident costs orders of magnitude more.

### Organisational Governance Impact

Traditional Architecture Review Boards are slow, centralised, and — as Thoughtworks Architecture Advice Process research confirms — **correlated with low organisational performance**. Vishwakarma's versioned ERD with inline review and approval is the infrastructure that makes decentralised architectural governance safe: teams decide, the Decision Ledger captures it, the approval workflow validates it.

### Architectural Review Tracking — The Business Case

| Scenario | Without Tracking | With Vishwakarma |
|---|---|---|
| **Regulatory audit** | "Who approved the authentication architecture?" — answered with email searches and meeting recalls | Version-stamped approval trail exportable in minutes |
| **Team handover** | New architect reads the system for weeks, rediscovers decisions already made, rebuilds context that existed | Complete version history + Decision Ledger shows exactly what was decided and why, from day one |
| **Architecture rework** | No record of what was intentional vs. what was a workaround — everything is treated as fixed | Every decision has a rationale; intentional trade-offs are distinguished from reckless assumptions |
| **Post-incident review** | "Why was this built this way?" — unanswerable without the people who were there | Decision Ledger entry for every architectural choice, with the alternative options that were considered |
| **Compliance** | Architecture decisions distributed across email, Confluence, Slack, tribal memory | Single, versioned, approved, exportable ERD that satisfies architecture governance requirements |

---

## 4. Innovation & Novelty

**Business impact is the core ideology.** Requirements quality is not a documentation concern — it is a delivery cost driver. Vishwakarma cuts that cost by making decisions explicit before they become assumptions baked into code.

### Built on Thoughtworks Engineering Principles

Vishwakarma is not built on novel ideas in isolation — it is built on **industry-proven Thoughtworks principles**, applied systematically at the point where they have been most absent: requirements time. These are not references added for credibility. They are enforcement rules baked into every prompt, every schema field, and every generated document section.

| Principle | Source | Reference | How Vishwakarma Enforces It |
|---|---|---|---|
| **Architecture Advice Process** | Thoughtworks Tech Radar Vol. 32, April 2025 — Trial | [architectural-decision-making.md](references/architectural-decision-making.md) | Inline review + approval workflow replaces Architecture Review Boards with continuous, decentralised governance |
| **Lightweight ADRs** | Thoughtworks Tech Radar — Adopt (graduated) | [architectural-decision-making.md](references/architectural-decision-making.md) | First-class output in every Technical ERD; noun-phrase titles, active-voice decisions, split consequences, immutable once accepted |
| **Evolutionary Architecture & Fitness Functions** | Ford, Parsons, Kua, Sadalage — Thoughtworks/O'Reilly 2022 | [evolutionary-architecture.md](references/evolutionary-architecture.md) | Every measurable NFR must declare how it will be verified in CI/CD — enforced in arc42 Section 6 generation |
| **Domain-Driven Design & Bounded Context** | Martin Fowler — Thoughtworks Chief Scientist | [ddd-microservices-architectural-style.md](references/ddd-microservices-architectural-style.md) | arc42 Section 5 and C4 Container decomposition enforced by business capability, not technology layer |
| **Conway's Law** | Martin Fowler — Thoughtworks | [conways-law-and-team-topologies.md](references/conways-law-and-team-topologies.md) | Team ownership check enforced in every C4 container diagram; mismatches surfaced as reviewer challenges |
| **C4 Model** | Simon Brown — validated by Thoughtworks Tech Radar | [c4-model.md](references/c4-model.md) | Context, Container, Component diagrams with strict schema — element limits, protocol labels, Conway's Law check |
| **Technical Debt Quadrant** | Martin Fowler — Thoughtworks | [legacy-modernisation-and-technical-debt.md](references/legacy-modernisation-and-technical-debt.md) | arc42 Section 11 classifies debt as prudent-deliberate or reckless — not a flat inventory |
| **Observability — OpenTelemetry** | Thoughtworks Tech Radar — Adopt | [observability.md](references/observability.md) | All three pillars — logs, metrics, traces — required in generated ERDs with a named approach |

> These are the principles that separate architecture that survives from architecture that gets rewritten.

---

## 5. Enriched Requirements Documents (ERDs)

An **Enriched Requirements Document** is neither a summary nor a template fill. It is the output of a structured interrogation — ambiguities resolved, decisions explicit, standards applied, every output element traceable to source. The ERD is a living, versioned artifact with a full review and approval lifecycle.

---

### Technical ERD *(Phase 1 — Built)*

| Framework | Standard | Best Suited For |
|---|---|---|
| **arc42 v9** | 12-section international architecture documentation standard | Enterprise systems, regulated industries, complex programmes |
| **C4 + ADR** | Simon Brown's C4 model + Martin Fowler ADR format | Microservices, diagram-first teams, API-oriented systems |
| **RFC** | Engineering Request for Comments | Open review culture, collaborative architectural governance |
| **Custom** | User-defined section structure | Teams with existing standards to preserve |

Every Technical ERD includes: framework sections derived from the pipeline · ADRs with trade-off cards · C4 diagrams in Mermaid v11 with ELK auto-layout · Live Presentation Mode · inline review and commenting · version tracking · approval workflow · change history · ZIP export (source-control ready).

---

### Functional ERD *(Phase 2)*

Same interrogation pipeline. Business-aligned output, following recognised business analysis standards:

| Format | Standard | Best Suited For |
|---|---|---|
| **BRD** | Business Requirements Document | Stakeholder and business communication — objectives, scope, assumptions, use cases |
| **FRD** | Functional Requirements Document | Detailed feature-level specification — system behaviour and user interactions |
| **User Story Map** | Agile epics → stories → acceptance criteria | Agile delivery teams |

Architecture characteristics surface as functional quality attributes — Security → data handling policy, Scalability → expected load projections, Availability → service level commitments. Same Decision Ledger, same version and approval history. Business and technical teams start from the same validated ground truth.

---

### Both Tracks

One upload. One pipeline run. Two complete, role-appropriate delivery artifacts — reviewed through the same approval workflow, versioned together. The misalignment that normally surfaces weeks into a project is resolved at source.

---

## 6. Platform Capabilities — What Is Built Today

| Capability | Status |
|---|---|
| Requirements ingestion — PDF, DOCX, Markdown, plain text | ✅ Built |
| Requirements Interrogation Engine — all detectable characteristics with confidence scores and source evidence | ✅ Built |
| Architecture characteristics priority ranking — human-confirmed, machine-readable priority vector | ✅ Built |
| Customisable characteristics — add, remove, reorder | ✅ Built |
| Architecture Interview — questions derived from confirmed priority order, not a fixed template | ✅ Built |
| Suggestive interview — scored approaches per decision; recommended best fit surfaced automatically | ✅ Built |
| Human override — every recommendation overridable; custom answers accepted at any step | ✅ Built |
| Bulk interview accept — all recommended answers committed simultaneously | ✅ Built |
| Decision Ledger — append-only record of every choice, rationale, and alternatives | ✅ Built |
| ERD-Technical — arc42 v9 (12 sections, section-level rules enforced) | ✅ Built |
| ERD-Technical — C4 + ADR (strict C4 schema + Fowler ADR format) | ✅ Built |
| ERD-Technical — RFC format | ✅ Built |
| ERD-Technical — Custom section structure | ✅ Built |
| Live streaming generation — section-by-section, server-sent events | ✅ Built |
| Architecture Decision Records — full alternatives, pros/cons, split consequences | ✅ Built |
| C4 diagrams — Mermaid v11 with ELK auto-layout, Context + Container + Component | ✅ Built |
| **Live Presentation Mode** — full-screen progressive C4 diagram reveal | ✅ Built |
| **Diagram query** — natural-language questions against rendered diagrams, live during presentations | ✅ Built |
| Inline section editing with AI conversational edits | ✅ Built |
| **GitHub-style inline review and commenting** — section-level threaded comments, anchored to versions | ✅ Built |
| **ERD version tracking** — named snapshots on every change; versions comparable | ✅ Built |
| **Approval workflow** — Draft → In Review → Approved; reviewer attribution and version stamps | ✅ Built |
| **Change history** — AI and human changes attributed, timestamped, logged | ✅ Built |
| Export — ZIP of Markdown, diagrams, ADRs, and approval history; source-control ready | ✅ Built |
| Track selector — Technical / Functional / Both | ✅ Built |
| JWT-based authentication — session and LLM-calling routes ownership-scoped per user | ✅ Built |
| ERD-Functional — BRD · FRD · User Story Map with plain-English diagrams | 🔄 Phase 2 |

---

## 7. Responsible AI

**The AI proposes. The human decides.** At no point does the platform make an autonomous architectural decision.

| Principle | How It Is Enforced |
|---|---|
| **Human-in-the-loop at every stage** | Architect confirms characteristics, ranks priority, selects interview answers. No characteristic or decision reaches the next stage without explicit confirmation. Approval workflow extends this to all reviewers — no ERD version is final without explicit sign-off. |
| **Suggestive, not prescriptive** | The system recommends the best-fit approach for every interview decision, scored against the team's confirmed priorities. Every recommendation is overridable. Custom answers accepted at any step. |
| **Cites, not asserts** | Every detected characteristic is traced to the source sentence in the original document — grounded in evidence the architect can verify, not in what the model would expect to find there. |
| **Complete audit trail** | Decision Ledger records every choice with what was considered and why. Approval history records every sign-off. AI-generated changes attributed to the model with the triggering prompt. Human edits attributed to the author. Nothing is a black box. |
| **Full output traceability** | Every section of the generated ERD traces back to a confirmed characteristic and a Decision Ledger entry. The architecture is derived — not generated. |

---

## 8. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Python 3.11+ + FastAPI + Pydantic v2 |
| AI Engine | Anthropic Claude — Streaming SSE |
| Database | MongoDB — Motor (async driver) + Beanie ODM; users, sessions, HLD versions, reviews, comments |
| Diagrams | Mermaid v11 + ELK Auto-layout |
| Architecture Standards | arc42 v9 · C4 Model · ADR (MADR) |
| Authentication | JWT bearer tokens; ownership-scoped access on session and LLM-calling routes |
| Local Storage | File-based — bulky per-session content (spec text, characteristics, HLD JSON) |

---

## 9. Visual Walkthrough

The complete end-to-end flow from requirements document to approved architecture. Each screenshot below shows a distinct stage in the pipeline — the journey from raw ambiguous text to a reviewed, version-stamped, approved Enriched Requirements Document.

---

### Step 1 — Requirements Upload and Track Selection

Upload the requirements document in any format. Select the output track — Technical, Functional, or Both. The track selection is not a filter applied at the end — it shapes how the engine reads the document from the first sentence. Business analysts and architects both start here; the pipeline diverges from this choice.

![Requirements Upload and Track Selection](images/image-1.png)

---

### Step 2 — Characteristics Detection and Priority Ranking

The Interrogation Engine returns detected quality attributes with confidence scores and the exact source sentences that imply them. The architect reviews all findings — adding characteristics the engine missed, removing false positives — and **drags to reorder by priority**. This ranked list is the machine-readable priority signal that governs the interview, the scoring, and the entire generated document. Nothing this precise is possible from a raw document alone.

![Characteristics Detection with Source Evidence and Priority Reordering](images/image-2.png)

---

### Step 3 — Architecture Interview — Scored Options and Decision Selection

Questions are derived from the confirmed characteristics in priority order — not a fixed template. Each question presents multiple architectural approaches scored against the team's confirmed ranking. The architect selects the best fit or overrides with a custom answer. **Bulk accept** commits all remaining recommended answers simultaneously when speed matters.

![Architecture Interview — Scored Approaches Per Decision](images/image-3.png)

Every individual answer is recorded in the Decision Ledger immediately.

![Single Decision — Alternatives, Scoring, and Custom Answer](images/image-4.png)

When time is constrained, the entire remaining interview can be accepted in one confirmed action — all recommended answers committed, all recorded.

![Bulk Accept — Entire Interview Resolved in One Confirmation](images/image-5.png)

---

### Step 4 — Documentation Framework Selection

Four standards-aligned frameworks are available once all decisions are resolved. The selection determines the structure, section rules, and documentation standard applied to the generated ERD. The Custom option preserves existing team standards.

![Documentation Framework Selection — arc42, C4+ADR, RFC, Custom](images/image-9.png)

Custom section structure editor — define exactly which sections the ERD should contain.

![Custom Section Structure Editor](images/image-8.png)

---

### Step 5 — Generated Technical ERD with Inline Editing

The complete ERD is generated in real time, section by section via live streaming. Architecture Decision Records with full trade-off cards are generated inline. Any section can be edited directly or revised through conversational AI prompts without regenerating the full document.

![Generated Technical ERD — Document View with Sections](images/image-12.png)

![Architecture Decision Records — Full Trade-off Cards Inline](images/image-13.png)

---

### Step 6 — C4 Architecture Diagrams

Context and Container level diagrams generated and rendered live in Mermaid v11 with ELK auto-layout. Compliant with Simon Brown's C4 specification. Immediately queryable in natural language from within the platform.

![C4 Architecture Diagram — Context and Container Level](images/image-14.png)

![C4 Diagram — Rendered with ELK Auto-layout](images/image-15.png)

---

### Step 7 — Live Presentation Mode

Full-screen presentation mode built directly on the generated C4 diagrams — no export, no PowerPoint, no preparation. The C4 hierarchy is revealed level by level on click. Stakeholders can ask questions in natural language and receive answers grounded in the generated architecture, live in the room.

![Live Presentation Mode — Full-screen C4 Progressive Reveal](images/image-16.png)

Configurable timing for automatic progression, or manual control for stakeholder-driven sessions.

![Live Presentation — Configurable Slide Timing and Manual Control](images/image-17.png)

---

### Step 8 — Submit ERD for Architectural Review

Once the author is satisfied, the ERD is submitted for review. The reviewer receives a direct link to the specific ERD version — no email thread, no shared editing, no version confusion.

![Submit ERD for Architectural Review](images/image-18.png)

---

### Step 9 — Reviewer Dashboard with Version History

The reviewer dashboard shows every ERD pending sign-off, the version it is currently at, and the complete version history of how the document evolved. Reviewers see exactly what changed between versions and which comment triggered each revision.

![Reviewer Dashboard — ERD Pending Sign-off with Version History](images/image-19.png)

---

### Step 10 — GitHub-Style Inline Review and Approval

Reviewers comment on specific sections — not the document as a whole. Comments are threaded, anchored to the version they reference, and tracked through to resolution. The approval is version-stamped with reviewer attribution and timestamp. This is the pull request review model applied to architecture documentation.

![ERD Inline Review — Section-level Threaded Comments](images/image-21.png)

![Comment Thread — Reply, Resolve, and Reopen Flow](images/image-22.png)

![Approval Workflow — Reviewer Sign-off with Version Attribution](images/image-23.png)

---

### Step 11 — Phase 2 Preview — Functional ERD

Same interrogation pipeline. Business-aligned output in BRD, FRD, or User Story Map format, with use case, process flow, and user journey diagrams in plain English. Architecture characteristics are surfaced as functional quality attributes — Security becomes a data handling policy, Scalability becomes expected load projections, Availability becomes service level commitments. Business and technical teams start from the same interrogated, approved source of truth.

![Functional ERD — Phase 2 Preview](images/image-24.png)

---

## 10. References

The intellectual grounding of the platform — every prompt rule, schema field, and generated document section traces to one of these.

### Architecture Decision Records
| | |
|---|---|
| Architecture Decision Record — Martin Fowler | https://martinfowler.com/bliki/ArchitectureDecisionRecord.html |
| Documenting Architecture Decisions — Michael Nygard | https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions |
| Lightweight ADRs — Thoughtworks Tech Radar (Adopt) | https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records |
| Architecture Advice Process — Thoughtworks Vol. 32, April 2025 (Trial) | https://www.thoughtworks.com/radar/techniques/architecture-advice-process |

### Architecture Diagrams & Documentation Standards
| | |
|---|---|
| C4 Model — Simon Brown | https://c4model.com/introduction |
| arc42 Architecture Documentation Standard | https://arc42.org/overview |

### Evolutionary Architecture & Fitness Functions
| | |
|---|---|
| Building Evolutionary Architectures — Thoughtworks / O'Reilly (2022) | https://www.thoughtworks.com/insights/books/building-evolutionary-architectures-second-edition |
| Fitness Function-Driven Development — Thoughtworks | https://www.thoughtworks.com/en-us/insights/articles/fitness-function-driven-development |
| Evolutionary Architecture Decoder — Thoughtworks | https://www.thoughtworks.com/en-us/insights/decoder/e/evolutionary-architecture |

### Domain-Driven Design & Microservices
| | |
|---|---|
| Bounded Context — Martin Fowler | https://martinfowler.com/bliki/BoundedContext.html |
| Domain-Driven Design — Martin Fowler | https://martinfowler.com/bliki/DomainDrivenDesign.html |
| Microservices — Martin Fowler & James Lewis | https://martinfowler.com/articles/microservices.html |
| Monolith First — Martin Fowler | https://martinfowler.com/bliki/MonolithFirst.html |

### Conway's Law & Team Topologies
| | |
|---|---|
| Conway's Law — Martin Fowler | https://martinfowler.com/bliki/ConwaysLaw.html |
| Team Topologies — Skelton & Pais (2nd ed. September 2025) | https://teamtopologies.com/key-concepts |
| Team Topologies — Thoughtworks Podcast | https://www.thoughtworks.com/insights/podcasts/technology-podcasts/team-topologies |

### Technical Debt, Observability, Technology Radar
| | |
|---|---|
| Technical Debt Quadrant — Martin Fowler | https://martinfowler.com/bliki/TechnicalDebtQuadrant.html |
| Strangler Fig Application — Martin Fowler | https://martinfowler.com/bliki/StranglerFigApplication.html |
| Observability as a Leadership Choice — Thoughtworks | https://www.thoughtworks.com/insights/blog/technology-strategy/drowning-in-dashboards-starving-for-clarity-why-observability-is-a-leadership-choice |
| OpenTelemetry — Thoughtworks Tech Radar (Adopt) | https://www.thoughtworks.com/radar/languages-and-frameworks/opentelemetry |
| Thoughtworks Technology Radar Vol. 32 — April 2025 | https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2025/04/tr_technology_radar_vol_32_en.pdf |

---

*Named after Vishwakarma — the divine architect of the universe in Hindu cosmology.*
*Built for the AI/Works Hackathon. Grounded in the principles that make architecture worth doing.*
