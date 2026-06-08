# Domain-Driven Design, Microservices & Architectural Style

> Decompose your system around the business — not the technology. Start simple, earn complexity.

---

## The Big Picture

These three concepts are a sequence, not separate topics:

```
Step 1 — DDD (Bounded Contexts)   Find your real business domains
                ↓
Step 2 — Monolith First            Start simple, learn your boundaries
                ↓
Step 3 — Microservices             Extract services only when scale justifies it
```

The mistake most teams make: jump from Step 1 directly to Step 3 before understanding their domains. They draw 15 microservices on day one, then spend two years untangling them.

---

## Part 1 — Domain-Driven Design & Bounded Contexts

### What It Is

DDD is an approach to designing software around the **business domain** — the real-world problem the software solves — rather than around technology layers.

The most important concept for architecture is the **Bounded Context**.

### What Is a Bounded Context?

A clear boundary inside which a specific business concept means one specific thing.

**Example — what is a "Customer" in an e-commerce platform?**

- **Sales context:** Customer = name, email, purchase history, loyalty points
- **Shipping context:** Customer = delivery address, contact number
- **Billing context:** Customer = payment method, invoice history

Same word. Completely different data. Completely different behaviour.

DDD says: don't force these into one giant "Customer" object. Define clear boundaries:

```
[Sales Context]     → Customer = name, email, loyalty points
[Shipping Context]  → Customer = delivery address, contact number
[Billing Context]   → Customer = payment method, invoice history
```

Inside each boundary, "Customer" has one clear, unambiguous meaning.

### Why This Matters for Architecture

The bounded context is the **correct unit of decomposition.** Before you ask "should this be a microservice?" you first ask "what are the bounded contexts?" Then you decide whether each context becomes a separate service, a module, or spans multiple services.

Most teams skip this step. They decompose by technology layer instead:

```
❌ Technology-layer split (wrong):
   Frontend  →  Backend  →  Database

✅ Business-capability split (correct):
   Order Service  |  Payment Service  |  Inventory Service
```

A frontend/backend/database split violates DDD and Conway's Law simultaneously — it creates artificial boundaries that don't match business ownership and make cross-team coordination unavoidable.

### How We Use It in Vishwakarma AI

Our arc42 prompt Section 5 (Building Blocks) enforces this:

> "Each building block has a **single stated responsibility.**"

That single responsibility rule is DDD in practice. The LLM is forced to decompose by business capability, not technology layer. If a spec describes a system in technology layers, the prompt pushes the LLM to reframe it around business domains.

*Source: [Bounded Context — Martin Fowler](https://martinfowler.com/bliki/BoundedContext.html)*

---

## Part 2 — Microservices & The Architectural Style Choice

### What Is a Microservice?

The formal definition (Fowler & Lewis, the people who coined the term):

> A suite of small, **independently deployable** services, each running its own process, communicating over HTTP APIs, **organised around business capabilities.**

Two key phrases: **independently deployable** and **organised around business capabilities.**

- A service that can only be deployed together with three other services → not a microservice
- A service split by technology layer (e.g. "the database service") → not a microservice
- A self-contained unit that maps to a business domain, deployed and scaled independently → genuine microservice

### Monolith First — The Rule Nobody Wants to Follow

Thoughtworks' position is counterintuitive but well-evidenced:

> **Start with a well-structured monolith. Learn your bounded contexts. Then extract services.**

Simon Brown (creator of C4), quoted by Fowler:

> "If you can't build a well-structured monolith, what makes you think you can build a well-structured set of microservices?"

**Why?** Getting microservice boundaries wrong is far more expensive than getting module boundaries wrong. Refactoring across process boundaries (separate deployed services) is strictly harder than refactoring across class boundaries inside one codebase.

### The Three Architectural Styles

```
Monolith          Single deployable unit. Simple ops. Best starting point.
Modular Monolith  Single deployable, enforced internal module boundaries. Underrated middle ground.
Microservices     Multiple deployable units. Complex ops. Right choice only at scale.
```

The **modular monolith** is the most overlooked option. You get clean domain boundaries without the operational overhead of running 20 separate services.

### When Are Microservices Justified?

Only when you have evidence of all three:

1. **Team scale** — multiple teams that need to deploy independently without coordinating
2. **Bounded context clarity** — you know exactly where domain boundaries are (means you've lived with the problem)
3. **Operational maturity** — CI/CD, observability, service mesh, distributed tracing already in place

Without all three, microservices add complexity without benefit.

### How We Use It in Vishwakarma AI

Section 4 (Solution Strategy) in `system.arc42.md` requires the LLM to justify the architectural style against quality goals:

> "Primary decomposition approach, key technology decisions with one-line rationale, how each quality goal is addressed."

`system.rfc.md` enforces proper reasoning with a specific example built into the prompt:

```
BAD:  "We considered microservices but chose a monolith."

GOOD: "Option B — Monolith: operationally simpler, sufficient for < 100 RPS.
       Rejected because PCI DSS requires payment data isolation that a monolith
       cannot provide without re-introducing coupling complexity."
```

The LLM cannot just state a choice — it must justify it against the constraints and quality goals from the spec.

*Sources: [Microservices — Fowler & Lewis](https://martinfowler.com/articles/microservices.html) · [Monolith First — Fowler](https://martinfowler.com/bliki/MonolithFirst.html)*

---

## Part 3 — How All Three Connect to Each Other

| Concept | The Question It Answers |
|---|---|
| **DDD / Bounded Contexts** | Where are the real boundaries in this business domain? |
| **Monolith First** | What is the simplest architecture that respects those boundaries? |
| **Microservices** | When should we split into independent deployable services? |

They build on each other. You can't make a good microservices decision without first understanding your bounded contexts. You can't understand your bounded contexts without DDD strategic design.

---

## How This Shows Up in Generated HLD Output

Instead of:

> "The system will have a Frontend, Backend, and Database."

Our generated HLD produces:

> "**Solution Strategy:** The system is decomposed into three bounded contexts — Orders, Payments, and Inventory — each owning its data store. A modular monolith is chosen for Phase 1 (team of 4, single deployment target). The Payments context will be extracted as a standalone service in Phase 2 once PCI DSS isolation requirements harden.
>
> ⚠️ **Reviewer challenge:** Does the current team have operational maturity (observability, CI/CD) to manage a distributed deployment before Phase 2 extraction begins?"

That's DDD (bounded contexts), Monolith First (modular monolith for Phase 1), and Microservices (justified extraction in Phase 2) all working together in one section of the output.

---

## The Known Gap & Future Direction

Currently, the LLM infers bounded contexts from the spec. If the spec is vague about business domains, the decomposition will also be vague.

The right fix — planned as a future interview phase — is to explicitly ask the user to confirm business domains before generation. This turns the LLM's inference into a validation step rather than a guess.

---

## Further Reading

- [Bounded Context — Martin Fowler](https://martinfowler.com/bliki/BoundedContext.html)
- [Domain Driven Design — Martin Fowler](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Microservices — Fowler & Lewis](https://martinfowler.com/articles/microservices.html) — the original definition
- [Monolith First — Martin Fowler](https://martinfowler.com/bliki/MonolithFirst.html)
