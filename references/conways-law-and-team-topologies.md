# Conway's Law & Team Topologies

> Your architecture will mirror your team structure — whether you plan it or not. Team Topologies gives you the playbook to make that work in your favour.

---

## Part 1 — Conway's Law

### The Statement

> "Any organisation that designs a system will produce a design whose structure is a copy of the organisation's communication structure."
> — Melvin Conway, 1967

### A Story That Makes It Click

Imagine two companies building the same e-commerce product.

**Company A** is organised by technology layer:
```
Frontend team  |  Backend team  |  Database team
```

Their architecture ends up looking like:
```
Frontend app  →  Backend API  →  Database
```

Three layers. Matching the three teams exactly.

**Company B** is organised by business domain:
```
Order team  |  Payments team  |  Inventory team
```

Their architecture ends up looking like:
```
Order Service  |  Payment Service  |  Inventory Service
```

Three independent services. Again, matching the team structure exactly.

**Same product. Completely different architecture. The only variable was how the teams were organised.**

Nobody decided to build it that way. It happened because teams naturally build along the lines they communicate. Company A's frontend team talks to the backend team — so there's a clean frontend/backend split. Company B's teams barely talk to each other — so their services are independent.

---

### The Three Responses

**1. Ignore it** — pretend it doesn't apply. The architecture drifts to match org structure anyway, but in an unplanned, dysfunctional way.

**2. Accept it** — acknowledge it and design the architecture around how your teams are currently structured.

**3. Inverse Conway Maneuver** — decide what architecture you *want*, then restructure your teams to match it. Used heavily in microservices migrations.

Thoughtworks recommends the third. You don't let org structure dictate architecture by accident — you deliberately shape both together.

---

## Part 2 — Team Topologies

Conway's Law tells you *that* team structure affects architecture. Team Topologies tells you *how to structure your teams* to get the architecture you actually want.

It defines exactly **four team types** and **three interaction modes**. That's it.

### The Four Team Types

**1. Stream-aligned team** ← the main team type

Owns a slice of the business domain end-to-end: frontend, backend, database, deployment, on-call. "You build it, you run it."

Example: The Payments team owns the checkout UI, the payment API, the payments database, and the on-call rotation when it breaks at 3am.

The goal: as many stream-aligned teams as possible. Everything else exists to reduce their cognitive load.

**2. Platform team**

Builds internal tooling that stream-aligned teams consume as self-service — CI/CD pipelines, cloud infrastructure templates, observability dashboards, developer portals.

Critical rule: **must never become a bottleneck.** If stream-aligned teams raise tickets and wait, it has failed. It must be fully self-service.

Example: An internal Kubernetes platform where any team deploys a service by filling in a YAML file — no tickets, no waiting.

**3. Enabling team**

A temporary team of specialists who embed with a stream-aligned team to fill a capability gap, then move on. They teach, they don't do. Their goal is to make themselves redundant.

Example: A security team embeds with the Payments team for 6 weeks to implement PCI-DSS compliance. Once the Payments team can handle it themselves, the enabling team moves to the next team.

**4. Complicated-subsystem team**

Handles one component requiring such deep specialist knowledge that a normal stream-aligned team can't maintain it without enormous cognitive overhead.

Example: A team owning a real-time fraud detection model — ML, statistics, real-time streaming. Too specialised for a general team to own alongside everything else.

---

### The Three Interaction Modes

**Collaboration** — two teams work closely together for a period to explore or build something new. High communication. Temporary by design — if it goes on too long, it means the boundary between the teams is wrong.

**X-as-a-Service** — one team consumes what another provides, like an external API. Low communication, clearly defined interface. Platform teams operate this way.

**Facilitation** — an enabling team works with a stream-aligned team to upskill them. The interaction ends when the upskilling is done.

---

### A Complete Example

**Old model — layered org:**
```
Frontend team  |  Backend team  |  DevOps team  |  DBA team
```
Every feature requires all four teams to coordinate. Slow. Architecture ends up as a layered monolith.

**Team Topologies model:**
```
Stream-aligned:  Order team, Restaurant team, Delivery team, Payments team
Platform:        Internal cloud platform (self-service deploy, monitoring, secrets)
Enabling:        Security team (embeds temporarily, sets up compliance, then leaves)
Complicated:     Route optimisation team (owns the complex delivery algorithm)
```

Now the Order team ships a feature end-to-end without talking to any other team. Fast flow. Clear ownership. Architecture matches team structure — intentionally.

---

### The Thinnest Viable Platform (TVP)

Internal platforms should provide just enough capability and no more. Over-engineered internal platforms become bureaucratic bottlenecks.

A TVP might just be: a wiki page with deployment instructions, a Terraform module, and a Grafana dashboard template. That's enough to start.

---

## How This Is Incorporated in Vishwakarma AI

This is where it gets concrete. Let me show you exactly where these concepts appear in our prompts.

### In `system.arc42.md`

```
Conway's Law awareness: Decomposition decisions must acknowledge the team structure
that will own each module. If team topology was not provided, flag it as an open assumption.

Level 1 (mandatory): top-level decomposition. Each building block has a single stated
responsibility. Conway's Law: note which team owns each block. Flag blocks whose
ownership boundary is misaligned with team structure.
```

What this means in practice: when the LLM generates Section 5 (Building Blocks) of an arc42 document, it must state who owns each building block. If the spec didn't mention team structure, it flags that as an assumption the reader must fill in.

### In `system.c4-adr.md`

```
Conway's Law: Container ownership must map to real team boundaries.
Flag misalignments explicitly.

Conway's Law: note which team owns each container.
Flag where team boundaries and container boundaries are misaligned.

| P8 Conway's Law | Container-to-team ownership is stated and any misalignments are flagged |
```

So in the C4 Container diagram, every container in the generated output should have a stated owner. And the self-evaluation checklist (P8) verifies this was done.

### In `system.rfc.md`

```
Conway's Law: State which team owns which component. If the proposed decomposition
creates ownership friction with the current team structure, flag it explicitly.
```

### In `system.custom-sections.md`

```
Conway's Law: Where component or service boundaries are discussed,
state which team owns each piece and flag any team-topology mismatch.
```

---

### What This Produces in the HLD

Instead of a section that says:

> "The system will have an Order Service, a Payment Service, and a Notification Service."

Our generated HLD says something like:

> "The system will have an Order Service (owned by the Order stream-aligned team), a Payment Service (owned by the Payments stream-aligned team), and a Notification Service (owned by the Platform team, consumed as X-as-a-Service).
>
> **Conway's Law flag:** The Order Service and the Cart Service are currently both owned by the same team. This creates a boundary erosion risk — without separate ownership, the services will gradually become tightly coupled. Consider splitting ownership or merging the services into one."

That second paragraph — the flag — is what makes the HLD genuinely useful. It's the kind of observation a senior architect would make in a review, now generated automatically.

---

## Further Reading

- [Conway's Law — Martin Fowler](https://martinfowler.com/bliki/ConwaysLaw.html) — updated October 2022 to cover remote-first working
- [Team Topologies — Official Site](https://teamtopologies.com/key-concepts) — 2nd edition September 2025
- [Team Topologies & Effective Software Delivery — Thoughtworks Podcast](https://www.thoughtworks.com/insights/podcasts/technology-podcasts/team-topologies) — Thoughtworks interview with Skelton and Pais
