# Legacy Modernisation & Technical Debt

> Be honest about where you're coming from and what shortcuts you've accepted. A good HLD reflects reality, not just the idealised target.

---

## The Big Picture

These two topics are both about **honesty in architecture documentation**:

- **Strangler Fig** forces the HLD to be honest about legacy context — you can't pretend you're building from scratch when you're not
- **Technical Debt Quadrant** forces the HLD to be honest about shortcuts — you can't hide debt in vague "areas for improvement"

---

## Part 1 — Legacy Modernisation: Strangler Fig Pattern

### The Problem

Companies rarely build systems from scratch. More often they have a legacy system that's been running for 5–10 years — critical to the business, fragile, slow to change, expensive to maintain.

The tempting solution: **rewrite it from scratch.** But this is one of the most dangerous moves in software. You spend 18 months building the new system, the old one keeps running and changing, and by the time you're done — the new system is already behind.

This is the **Big Bang rewrite** and it fails more often than it succeeds.

### The Strangler Fig Pattern

Named after the strangler fig tree in Queensland rainforests — a vine that wraps around a host tree, grows around it over years, and eventually the host dies and the fig stands on its own.

In software: **you don't replace the legacy system. You grow the new system around it, piece by piece, until the legacy is no longer needed.**

### A Concrete Example

You have a 10-year-old monolithic e-commerce platform. You want to migrate to a modern architecture.

**Big Bang (wrong):**
```
Month 1–18: Build entirely new platform in parallel
Month 19:   Flip the switch, turn off the old system
→ Catastrophic risk. Users see everything break at once.
```

**Strangler Fig (right):**
```
Week 1:    Put a routing façade (proxy) in front of the old system.
           All traffic still goes to the old system. Users notice nothing.

Month 1:   Extract Payments into a new service.
           Façade routes /checkout → new Payments service.
           Everything else → old system. Still.

Month 3:   Extract Product Catalogue.
           Façade routes /products → new Catalogue service.
           Everything else → old system. Still.

Month 6:   Extract Orders.
           ...continue until old system handles nothing.
           Decommission it.
```

The **routing façade** is the key — a proxy that sits in front of everything and decides where to send each request. Users never know anything changed.

### The Hard Part: Data Migration

Fowler is explicit about this: **the code migration is easy. The data migration is hard.**

When you extract a service, it needs its own database. But data is still in the legacy database. Both systems are live and writing simultaneously.

The solution is **CDC (Change Data Capture)** — a technique that streams every write from the legacy database to the new service's database in real-time, keeping them in sync during transition. Once migration is complete, the legacy database connection is cut.

### Why It Matters for HLD Generation

A system migrating from legacy has completely different architectural concerns than a greenfield system:

- How does the new system coexist with the old one during transition?
- What's the routing strategy?
- How does data migrate without downtime?
- What's the rollback plan mid-migration?

Most tools ignore this entirely and generate an HLD as if you're starting from zero.

### How We Use It in Vishwakarma AI

**In `system.arc42.md` — Section 4 (Solution Strategy):**
```
"evolutionary architecture enablers
(strangler fig patterns, feature flags, anti-corruption layers)"
```

**In `system.rfc.md` — Section 8 (Rollout Plan):**
```
"If zero-downtime migration is required, state the strategy
(strangler fig, feature flag, dark launch, etc.)"
```

So if the spec mentions a legacy system or a migration, the LLM includes a transition plan — not just the target architecture.

*Sources: [Strangler Fig Application — Fowler (Aug 2024)](https://martinfowler.com/bliki/StranglerFigApplication.html) · [Embracing the Strangler Fig — Thoughtworks](https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one)*

---

## Part 2 — Technical Debt: The Quadrant

### What Technical Debt Is

Technical debt is a metaphor from Ward Cunningham (Agile Manifesto co-author):

> Taking a shortcut in your code is like taking a loan. It gets you somewhere faster right now. But you pay interest every day the shortcut stays in the codebase. If you never pay it back, it compounds.

Most people use "technical debt" as a catch-all for "bad code." Fowler's Technical Debt Quadrant breaks it into four distinct types — and the distinction matters for what you do about each.

### The Four Quadrants

Two axes:
- **Deliberate vs Inadvertent** — did you choose to do this, or did it happen by accident?
- **Reckless vs Prudent** — did you think it through, or was it careless?

```
                    DELIBERATE              INADVERTENT
                ┌───────────────────┬──────────────────────────┐
    RECKLESS    │ "We don't have    │ "What's layering?        │
                │ time for design"  │ We didn't know."         │
                │                   │                          │
                │ → Most dangerous  │ → Inexperience           │
                ├───────────────────┼──────────────────────────┤
    PRUDENT     │ "We must ship     │ "Now we know how we      │
                │ now, we'll fix    │ should have done it."    │
                │ later."           │                          │
                │ → Valid trade-off │ → Inevitable, even for   │
                │   with a plan     │   excellent teams        │
                └───────────────────┴──────────────────────────┘
```

**Reckless + Deliberate — the worst kind**

> "We don't have time for design."

A conscious decision to skip good practices with no intention of fixing it. This is what kills codebases over years.

**Reckless + Inadvertent**

> "What's a layered architecture? We didn't know."

Poor decisions from inexperience. Not malicious, but still costly. Needs education and remediation.

**Prudent + Deliberate — the legitimate kind**

> "We must ship now, and we know what we'll need to fix later."

A conscious trade-off with a repayment plan. This is valid engineering when three conditions are met: you understand the shortcut, you know what fixing it will cost, and there's an actual plan to do it.

**Prudent + Inadvertent — inevitable on every project**

> "Now we know how we should have done it."

You made the best decision with the information you had. The system evolved, you learned, and now a better approach is clear. This happens on every project regardless of team skill. It's not failure — it's learning.

### Why This Matters for HLD Generation

Listing "areas of technical debt" in an HLD is useless without classification. The reader needs to know:

- Is this a **strategic trade-off** (Prudent + Deliberate) — accepted consciously with a plan?
- Or an **accumulated liability** (Reckless) — something that needs urgent attention?

These require completely different responses. The first is managed risk. The second is unmanaged risk.

### How We Use It in Vishwakarma AI

**In `system.arc42.md` — Section 11 (Risks and Technical Debt):**
```
"Table: Risk | Probability (H/M/L) | Impact (H/M/L) | Mitigation | Owner.
Minimum three risks across: integration, operational, security,
and peak-load performance."
```

From `architecture-standards.md`:
> "Section 11 should classify identified debt by quadrant — not just list it — so reviewers understand whether the debt is a strategic trade-off or an accumulated liability."

**What this produces in the generated HLD:**

Instead of:
> "There is some technical debt in the authentication module."

The generated output says:
> "**Prudent-Deliberate:** JWT tokens currently have no refresh mechanism. This shortcut was accepted to meet the Q1 launch date. Repayment plan: ADR-004 covers token rotation implementation in Q2. Impact if not addressed: session hijacking risk grows over time as tokens remain valid indefinitely.
>
> **Reckless-Inadvertent:** The Order Service directly queries the Inventory database. This cross-service coupling was introduced without a clear design intent and violates service boundary isolation. No current repayment plan. Recommend: introduce an Inventory API contract and migrate to async event consumption within 2 sprints."

That's the difference between a generic debt list and a genuinely useful one.

*Source: [Technical Debt Quadrant — Martin Fowler](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)*

---

## How Both Connect to Each Other

| Concept | What It Forces the HLD to Acknowledge |
|---|---|
| Strangler Fig | Where you're migrating *from* — the legacy context and transition plan |
| Technical Debt Quadrant | What shortcuts were taken — classified by type, with mitigation plans |

Both make the HLD a document that reflects **the actual system** rather than just the idealised target state. That's what separates an HLD that gets approved in a review from one that gets sent back with "this doesn't reflect reality."

---

## Further Reading

- [Strangler Fig Application — Martin Fowler (Aug 2024)](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [Embracing the Strangler Fig Pattern — Thoughtworks](https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one)
- [Technical Debt Quadrant — Martin Fowler](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)
