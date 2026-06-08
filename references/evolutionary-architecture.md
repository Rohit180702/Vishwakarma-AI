# Evolutionary Architecture & Fitness Functions

> Design your system to *expect* change, not resist it — and automate the rules that keep it healthy.

---

## The Big Picture

Most teams design an architecture, build it, and then — over time — it slowly rots. New features get bolted on, shortcuts get taken, and two years later nobody wants to touch it because changing one thing breaks three others. The architecture became rigid without anyone deciding to make it rigid.

**Evolutionary Architecture is the answer to that.**

The three resources below cover the same idea from three angles:

```
Book (concept)       →  what evolutionary architecture means and why
Fitness Functions    →  how you implement it in your CI/CD pipeline
Decoder (summary)    →  the real trade-offs and what it looks like at companies like GitHub
```

---

## Part 1 — Building Evolutionary Architectures (The Book)

*Thoughtworks / O'Reilly, 2nd Edition December 2022*
*Authors: Neal Ford, Rebecca Parsons, Patrick Kua, Pramod Sadalage*

### What It Says

The core definition:

> "An architecture that supports guided, incremental change across multiple dimensions."

Two key words — **guided** and **incremental**.

- **Incremental** = you don't rewrite everything at once. You change one piece at a time.
- **Guided** = those changes are verified against automated rules (fitness functions) that make sure you're not accidentally breaking something important.

### A Concrete Example

You build a payment service. Your architecture rule: "it must respond in under 200ms."

Six months later, a developer adds fraud detection — a call to an external API. Suddenly the payment service takes 800ms. Nobody intended this. The rule was silently broken.

In an evolutionary architecture, that rule is encoded as an automated test running in your CI/CD pipeline. The moment the developer pushes code, the pipeline measures response time, sees 800ms, and **fails the build**. The rule is caught before it ever reaches production.

That's "guided" — architecture goals are enforced automatically, not reviewed by a human once a year.

### How It's Useful for Us

In our HLD prompts, we require that for every measurable NFR, the output must state *how it will be automatically verified*. We don't let the LLM say "the system should be fast." We make it say:

> "Response time p99 < 200ms. Verified by: k6 load test in CI/CD pipeline."

That instruction comes directly from this book.

---

## Part 2 — Fitness Function-Driven Development

*Thoughtworks, January 2019*

### What It Is

A **fitness function** is simply: a test that verifies an architectural goal is still being met.

You already write unit tests to verify your *code* is correct. A fitness function verifies your *architecture* is correct.

### The Parallel

| | Unit Test | Fitness Function |
|---|---|---|
| What it tests | A function returns the right value | An architectural goal is still met |
| When it runs | On every commit | On every commit |
| Written by | Developers | Developers (or architects) |
| Example | `calculateTotal(5, 10) === 15` | `p99 latency < 200ms` |

### Real Examples

**Performance**
```
k6 load test: 100 concurrent users, p99 response time must be < 500ms
→ Fails the build if breached
```

**Security**
```
OWASP dependency check: no known critical CVEs in any dependency
→ Fails the build if any found
```

**Architecture boundary**
```
ArchUnit rule: no class in the `payments` package may import from `orders` package
→ Fails the build if boundary is violated
```

**Compliance**
```
Log scanner: no field named `password`, `ssn`, or `credit_card` may appear in logs
→ Fails the build if found
```

**Observability**
```
Smoke test: /metrics endpoint must return HTTP 200 and contain `http_requests_total`
→ Fails the deployment if missing
```

### The Key Insight

Without fitness functions, "the system must be secure" is just a sentence in a document.

With fitness functions, it becomes a gate that every code change must pass through.

The architecture document stops being a PDF nobody reads and becomes a **living contract the CI/CD pipeline enforces**.

### How It's Useful for Us

This is directly embedded in our prompts. Every measurable quality attribute in the generated HLD must state a specific verification method:

- Availability 99.9% → "Verified by: Datadog SLO monitor, alerting if 30-day error budget < 20%"
- No PII in logs → "Verified by: automated log scanner in CI checking for PII field name patterns"
- Service boundary isolation → "Verified by: ArchUnit test preventing cross-package imports"

---

## Part 3 — Evolutionary Architecture Decoder

*Thoughtworks, evergreen article*

### What It Covers

This is the honest trade-off summary — what you gain, what it costs, and what it looks like at real companies.

### What You Gain

**Faster adaptation** — when requirements change (and they always do), you change the architecture incrementally instead of a big risky rewrite. Each small change is verified by fitness functions, so you know it's safe.

**Lower cost of change** — the longer rigid architecture stays in place, the more expensive change becomes. Evolutionary architecture keeps the cost of change roughly flat over time instead of exponentially increasing.

### The Real-World Example: GitHub

GitHub needed to migrate their Git repository storage layer — the piece of infrastructure that every single operation on their platform touches. A traditional "big bang" rewrite would have been catastrophic.

Instead, they used evolutionary architecture:
- Changed one component at a time
- Fitness functions verified each change didn't break existing behaviour
- No single deployment was high risk — each was small and verified

The migration took longer in calendar time, but **zero major incidents occurred**.

### The Trade-off

Evolutionary architecture requires upfront investment in fitness functions and CI/CD infrastructure. You're writing tests for architectural goals before you've built the full system.

Some teams resist this: *"Why are we writing tests for things we haven't built yet?"*

The answer is the same as TDD: the discipline of writing the test first forces you to be precise about what you're building. Vague architecture goals don't survive the moment you try to turn them into a measurable test.

### How It's Useful for Us

This is the framing in our prompts when the LLM explains decomposition choices:

> "Every container must explain how it enables future change, not just what it does today. Irreversible decisions must be flagged explicitly."

So a generated HLD won't say "we chose microservices." It will say:

> "We chose microservices because each domain can be deployed and scaled independently — enabling teams to release without coordination. The trade-off is operational complexity. This decision is difficult to reverse at scale."

---

## How All Three Connect to Vishwakarma AI

| Concept | Where It Shows Up in Our Output |
|---|---|
| Incremental change as first principle | Decomposition choices must explain how they enable future change |
| Fitness functions for NFRs | Every measurable quality attribute includes a "Verified by" statement |
| Irreversible decisions flagged | Prompts explicitly require flagging decisions that are hard to undo |
| Architecture as a living contract | Generated HLD is meant to be a working document, not a one-time deliverable |

---

## Further Reading

- [Building Evolutionary Architectures, 2nd Ed — O'Reilly](https://www.thoughtworks.com/insights/books/building-evolutionaryarchitectures-second-edition) — the foundational text
- [Fitness Function-Driven Development — Thoughtworks](https://www.thoughtworks.com/en-us/insights/articles/fitness-function-driven-development) — practical implementation guide with code examples
- [Evolutionary Architecture Decoder — Thoughtworks](https://www.thoughtworks.com/en-us/insights/decoder/e/evolutionary-architecture) — concise explainer with trade-offs
