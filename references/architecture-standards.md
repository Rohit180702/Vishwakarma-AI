# Architecture Standards & References

A curated reference list of the standards, practices, and frameworks that inform Vishwakarma AI's HLD generation engine. Every prompt, template, and quality rule in this project traces back to one or more of these sources.

---

## 1. Architecture Decision Records (ADRs)

### Lightweight Architecture Decision Records — Thoughtworks Tech Radar

**URL:** [https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)
**Last updated:** May 2018 (reached "Adopt" status — graduated off the radar as a baseline expectation, not an emerging practice)

**What it says:** Thoughtworks' official position on ADRs. Moved to "Adopt" meaning every project should use this — it is no longer debatable. Records architectural decisions with their context and consequences. Must be stored in source control alongside the code, not in a wiki, so they stay in sync with the codebase. Once accepted, an ADR is never modified — it is superseded by a new one.

**What we use from this:** ADRs are non-negotiable in every generated HLD. Our prompts require a minimum of three per document, stored at `/docs/adr/`.

---

### Architecture Advice Process — Thoughtworks Tech Radar (Vol 32, April 2025)

**URL:** [https://www.thoughtworks.com/radar/techniques/architecture-advice-process](https://www.thoughtworks.com/radar/techniques/architecture-advice-process)
**Last updated:** April 2025 — most current TW radar entry on architectural governance

**What it says:** The State of DevOps report found that traditional Architecture Review Boards are counterproductive — they hinder flow and correlate with low organisational performance. TW recommends a decentralised "advice process": anyone can make any architectural decision, provided they seek advice from those affected. ADRs are the paper trail that makes this safe. This model has been validated at scale including in highly regulated industries.

**What we use from this:** The rationale for why our output includes ADRs — not as bureaucratic documents but as the mechanism that makes decentralised architectural decision-making safe and auditable.

---

### Architecture Decision Record — Martin Fowler

**URL:** [https://martinfowler.com/bliki/ArchitectureDecisionRecord.html](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)
**Last updated:** 2022 (Fowler is Thoughtworks Chief Scientist)

**What it says:** Canonical practitioner definition. One page maximum, inverted pyramid style (most important material first). Must list all serious alternatives with pros and cons. Never modify an accepted ADR — supersede it with a new one. ADRs serve two purposes: historical record (why is the system built this way?) and clarification tool (writing forces different viewpoints to be resolved). Recommends `doc/adr/` inside the repository.

**What we use from this:** The exact format — noun-phrase titles, active-voice decisions ("We will use…"), alternatives with pros/cons, split positive/negative consequences, immutable once accepted.

---

## 2. Evolutionary Architecture & Fitness Functions

### Building Evolutionary Architectures, 2nd Edition — Thoughtworks / O'Reilly

**URL:** [https://www.thoughtworks.com/insights/books/building-evolutionaryarchitectures-second-edition](https://www.thoughtworks.com/insights/books/building-evolutionaryarchitectures-second-edition)
**Published:** December 2022 — latest and only current edition
**Authors:** Neal Ford, Rebecca Parsons, Patrick Kua, Pramod Sadalage (all Thoughtworks)

**What it says:** The foundational text for evolutionary architecture. Defines it as an architecture that "supports guided, incremental change across multiple dimensions." The second edition (2022) added a new co-author and focused heavily on automating architectural governance. Introduces fitness functions — objective, automated measurements that verify an architecture is meeting its stated goals. Covers how different architectural styles affect evolvability. Key argument: architecture should be guided by fitness functions running in CI/CD, not by periodic human reviews.

**What we use from this:** The fitness function requirement in every generated HLD — for each measurable NFR, the output must state how it will be automatically verified in CI/CD.

---

### Fitness Function-Driven Development — Thoughtworks

**URL:** [https://www.thoughtworks.com/en-us/insights/articles/fitness-function-driven-development](https://www.thoughtworks.com/en-us/insights/articles/fitness-function-driven-development)
**Published:** January 2019 (concepts are current — fitness functions have not changed)

**What it says:** The practical guide to implementing fitness functions. Parallel to TDD: just as unit tests verify functional code, fitness functions verify architectural goals (the "-ilities"). Provides concrete code examples across: code quality (test coverage ≥ 90%), resiliency (error rate < 1% during rolling deployment), observability (structured logs, metrics endpoint, tracing IDs), performance (p99 < 10 seconds), compliance (no PII in logs, GDPR audit age < 365 days), security (no OWASP Top 10, no plaintext secrets). Fitness functions belong in build pipelines as automated quality gates.

**What we use from this:** The specific language in our NFR sections — every measurable quality attribute must state: "Verified by: [ArchUnit rule / k6 load test / Datadog SLO monitor / chaos experiment]."

---

### Evolutionary Architecture Decoder — Thoughtworks

**URL:** [https://www.thoughtworks.com/en-us/insights/decoder/e/evolutionary-architecture](https://www.thoughtworks.com/en-us/insights/decoder/e/evolutionary-architecture)
**Last updated:** Evergreen Thoughtworks page, actively maintained

**What it says:** A concise explainer of evolutionary architecture. Covers: what it is (incremental change as a first principle), what you gain (faster adaptation, lower cost of change), trade-offs (balancing upfront vs incremental design), and real-world examples including GitHub refactoring critical infrastructure using evolutionary architecture principles.

**What we use from this:** The framing in our prompts — decomposition choices must explain how they enable, not prevent, future change. Irreversible decisions must be flagged explicitly.

---

## 3. C4 Model for Architecture Diagrams

### C4 Model — Official Site (Simon Brown)

**URL:** [https://c4model.com/introduction](https://c4model.com/introduction)
**Last updated:** Actively maintained by Simon Brown

**What it says:** The C4 model (Context, Container, Component, Code) is the industry standard for software architecture diagrams, created by Simon Brown 2006–2011. It solves the problem that UML is too complex and ad hoc "boxes and lines" diagrams are too inconsistent. The four levels act like map zoom levels. Strict rules: Context diagrams show only the system boundary, persons, and external systems (no technology terms, maximum 10 elements); Container diagrams show every separately deployable unit with technology annotation (no classes or functions, maximum 15 elements); every edge label must include a protocol (REST/HTTPS, gRPC, AMQP, etc.); all node type labels use C4 bracket notation (`[Container: PostgreSQL 16]`, `[Person]`, `[Software System]`). Thoughtworks endorses C4 as the standard for communicating architecture to mixed-skill stakeholders.

**What we use from this:** The entire diagram generation schema — node types, edge label requirements, element count limits, bracket notation, level rules.

---

## 4. Conway's Law & Team Topology

### Conway's Law — Martin Fowler

**URL:** [https://martinfowler.com/bliki/ConwaysLaw.html](https://martinfowler.com/bliki/ConwaysLaw.html)
**Last updated:** October 2022 (updated to cover remote-first working)

**What it says:** "Any organisation that designs a system will produce a design whose structure is a copy of the organisation's communication structure." Three responses: ignore it (produces architectural dysfunction), accept it (design around your team structure), or apply the Inverse Conway Maneuver (restructure teams to get the architecture you want — used heavily in microservices adoption). Key principle: the modular decomposition of a system and the decomposition of the development organisation must be done together and must evolve together throughout the life of the enterprise.

**What we use from this:** Every container or building block in our output must state which team owns it. Any mismatch between team structure and system decomposition must be flagged as a reviewer challenge.

---

### Team Topologies — Official Site

**URL:** [https://teamtopologies.com/key-concepts](https://teamtopologies.com/key-concepts)
**Last updated:** Actively maintained (2nd edition September 2025)
**Authors:** Matthew Skelton and Manuel Pais

**What it says:** The operational framework for Conway's Law. Defines four team types: Stream-aligned teams (own a slice of the business domain end-to-end, "You Build It, You Run It"), Platform teams (provide internal self-service products that reduce cognitive load on stream-aligned teams), Enabling teams (temporarily embed with teams to bridge capability gaps, then move on), Complicated-subsystem teams (handle components requiring specialist expertise). Three interaction modes: Collaboration, X-as-a-Service, Facilitation. Key concept: the Thinnest Viable Platform (TVP) — internal platforms should provide just enough capability, never become a bottleneck. Endorsed heavily by Thoughtworks.

**What we use from this:** When our prompts require team ownership per container, the answer should classify the owning team by type — stream-aligned, platform, or enabling. This is what makes the Conway's Law check meaningful rather than nominal.

---

### Team Topologies & Effective Software Delivery — Thoughtworks Podcast

**URL:** [https://www.thoughtworks.com/insights/podcasts/technology-podcasts/team-topologies](https://www.thoughtworks.com/insights/podcasts/technology-podcasts/team-topologies)
**Published:** Thoughtworks Technology Podcast (active series)

**What it says:** Thoughtworks interview with Skelton and Pais on how Team Topologies applies in practice. Core summary: optimising for fast flow, rapid feedback, and limits on team cognitive load will naturally produce an organization that looks like Team Topologies. Stream-aligned teams with end-to-end responsibility are the goal — everything else (platform teams, enabling teams) exists to reduce their cognitive load.

**What we use from this:** Validation that team topology is a primary concern in architectural decomposition, not an organisational afterthought.

---

## 5. Domain-Driven Design (DDD)

### Bounded Context — Martin Fowler

**URL:** [https://martinfowler.com/bliki/BoundedContext.html](https://martinfowler.com/bliki/BoundedContext.html)
**Last updated:** Regularly maintained on martinfowler.com

**What it says:** Bounded Context is the central pattern of DDD's strategic design. A Bounded Context is an explicit boundary within which a specific domain model and Ubiquitous Language apply. The same term ("Customer", "Order") can mean different things in different contexts — this is intentional, not a problem to be solved by unification. DDD addresses large systems by dividing them into Bounded Contexts, each with a unified internal model. Context Mapping documents how bounded contexts interact (Anti-Corruption Layer, Open Host Service, Shared Kernel). Bounded Contexts are the primary tool for decomposing a system into microservices or modules — get the context boundaries right before drawing service lines.

**What we use from this:** When our prompts ask for decomposition guidance in arc42 Section 5 and C4 Container diagrams, the correct approach is DDD strategic design first — identify bounded contexts, then decide whether each context becomes a service, a module, or spans multiple services.

---

### Domain Driven Design — Martin Fowler

**URL:** [https://martinfowler.com/bliki/DomainDrivenDesign.html](https://martinfowler.com/bliki/DomainDrivenDesign.html)
**Last updated:** Maintained on martinfowler.com

**What it says:** DDD is an approach to software development that centres development on a domain model with a rich understanding of business processes and rules. Originated in Eric Evans' 2003 book. Two major components: Tactical patterns (Entities, Value Objects, Aggregates, Domain Events — code-level patterns), and Strategic patterns (Bounded Contexts, Context Maps, Ubiquitous Language — architecture-level patterns). The strategic patterns are the ones relevant to HLD generation. Key warning: start with strategic design (context boundaries) before applying tactical patterns — the most common DDD mistake is building beautiful Aggregates before defining context boundaries.

**What we use from this:** The principle that decomposition in an HLD must be business-capability-aligned, not technology-layer-aligned. A frontend/backend/database split violates DDD and Conway's Law simultaneously.

---

## 6. Microservices & Architectural Style

### Microservices — Martin Fowler & James Lewis

**URL:** [https://martinfowler.com/articles/microservices.html](https://martinfowler.com/articles/microservices.html)
**Published:** March 2014 — the original definition of microservices (still the canonical reference)
**Authors:** Martin Fowler (TW Chief Scientist) + James Lewis (TW Technical Director)

**What it says:** The article that defined the term "microservices". Core definition: an architectural style where a single application is developed as a suite of small, independently deployable services, each running its own process, communicating over lightweight mechanisms (typically HTTP APIs), organised around business capabilities. Explicitly invokes Conway's Law as the reason teams should be organised around business capabilities rather than technology layers. Identifies nine characteristics of microservices: componentization via services, organised around business capabilities, products not projects, smart endpoints and dumb pipes, decentralised governance, decentralised data management, infrastructure automation, design for failure, evolutionary design.

**What we use from this:** The formal criteria for when a Container diagram correctly represents a microservices architecture — each container must map to a business capability, not a technology layer.

---

### Monolith First — Martin Fowler

**URL:** [https://martinfowler.com/bliki/MonolithFirst.html](https://martinfowler.com/bliki/MonolithFirst.html)
**Last updated:** Maintained on martinfowler.com

**What it says:** TW's position on when to choose microservices vs monolith. Core argument: start with a well-structured monolith, learn your bounded contexts, then extract services. "If you can't build a well-structured monolith, what makes you think you can build a well-structured set of microservices?" (Simon Brown, quoted by Fowler). The penalty for getting microservice boundaries wrong is much higher than the penalty for getting module boundaries wrong in a monolith — refactoring across process boundaries is strictly harder than refactoring across classes. A modular monolith (single deployment, enforced internal boundaries) is a valid and often underrated intermediate state.

**What we use from this:** Our prompts should challenge any HLD that proposes microservices without evidence of team scale, bounded context clarity, and operational maturity. The arc42 Solution Strategy section should justify the architectural style choice explicitly.

---

## 7. Legacy Modernisation

### Strangler Fig Application — Martin Fowler

**URL:** [https://martinfowler.com/bliki/StranglerFigApplication.html](https://martinfowler.com/bliki/StranglerFigApplication.html)
**Last updated:** August 2024 (Fowler updated the page)

**What it says:** The standard approach for migrating legacy systems incrementally rather than via "big bang" rewrite. Named after the strangler fig tree observed in Queensland rainforests in 2001 — a vine that grows around a host tree until the host dies and the fig remains. In software: build new functionality around the edges of the legacy system using a routing façade (proxy), gradually move features over, then decommission the legacy. The façade intercepts all requests and routes each one to either the legacy or new system — clients never know anything changed. Data migration (not code) is the hard part; use CDC (Change Data Capture) from the legacy database rather than fragile dual-writes. Key principle: transitional architecture (the façade) that will be thrown away is a worthwhile investment because it reduces risk and enables continuous delivery of value throughout the migration.

**What we use from this:** Any HLD involving a legacy system replacement must include a transition plan using the Strangler Fig approach. Arc42 Section 4 (Solution Strategy) and the Rollout section of RFC documents must address this explicitly.

---

### Embracing the Strangler Fig Pattern for Legacy Modernisation — Thoughtworks

**URL:** [https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one](https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one)
**Published:** Thoughtworks insights article (active)

**What it says:** Thoughtworks' practical application guide for the Strangler Fig pattern on real client projects. Covers how to identify the first slice to extract (smallest, most self-contained, highest business value), how to build an API gateway as the routing façade, how to maintain backward compatibility for existing consumers while offering an improved API to new consumers. Emphasises that each slice is iterative: build, reroute, retire. Shows that the pattern reduces risk of system migration and minimises disruption to ongoing business operations.

**What we use from this:** Validation that the Strangler Fig pattern is current TW practice, not a theoretical pattern.

---

## 8. Technical Debt

### Technical Debt Quadrant — Martin Fowler

**URL:** [https://martinfowler.com/bliki/TechnicalDebtQuadrant.html](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)
**Last updated:** Maintained on martinfowler.com

**What it says:** A taxonomy for categorising technical debt across two axes — deliberate vs inadvertent, and reckless vs prudent — producing four quadrants: (1) Prudent-Deliberate: conscious shortcut with a repayment plan ("we'll fix after launch"), (2) Reckless-Deliberate: conscious shortcut with no plan ("we don't have time for design"), (3) Prudent-Inadvertent: best-practice decisions that later prove suboptimal as the system evolves — inevitable even for excellent teams, (4) Reckless-Inadvertent: poor decisions born of inexperience. The most important insight: not all technical debt is bad — Prudent-Deliberate debt is a legitimate engineering trade-off. The most dangerous is Reckless-Deliberate debt accumulated under deadline pressure with no repayment plan.

**What we use from this:** The Risks and Technical Debt section in arc42 (Section 11) should classify identified debt by quadrant — not just list it — so reviewers understand whether the debt is a strategic trade-off or an accumulated liability.

---

## 9. Observability

### Observability as a Leadership Choice — Thoughtworks

**URL:** [https://www.thoughtworks.com/insights/blog/technology-strategy/drowning-in-dashboards-starving-for-clarity-why-observability-is-a-leadership-choice](https://www.thoughtworks.com/insights/blog/technology-strategy/drowning-in-dashboards-starving-for-clarity-why-observability-is-a-leadership-choice)
**Published:** Thoughtworks Technology Strategy blog (active)

**What it says:** Thoughtworks' current position on observability. The three pillars — logs (timestamped record of every event), metrics (numbers that tell you if the system is alive), and traces (journey of a single request across all services) — must be unified through a standard like OpenTelemetry, not fragmented across different tools. TW recommendation: mandate OpenTelemetry as a strategic standard so telemetry data is portable and vendor-agnostic. Observability is a leadership choice because fragmented tooling creates fragmented understanding — you can drown in dashboards while being starved of clarity.

**What we use from this:** Every generated HLD must address all three pillars explicitly in the observability/crosscutting section — not just "we'll add logging", but a specific approach to structured logs, metrics instrumentation, and distributed tracing with correlation IDs.

---

### OpenTelemetry — Thoughtworks Tech Radar

**URL:** [https://www.thoughtworks.com/radar/languages-and-frameworks/opentelemetry](https://www.thoughtworks.com/radar/languages-and-frameworks/opentelemetry)
**Last updated:** Current Tech Radar entry

**What it says:** OpenTelemetry is now the industry standard for observability. It merges the former OpenTracing and OpenCensus standards into a single vendor-agnostic framework covering all three pillars: traces, metrics, and logs. The OpenTelemetry Protocol (OTLP) is a standardised transport format that eliminates vendor lock-in. TW considers it the de-facto choice for telemetry transport in microservices and distributed architectures.

**What we use from this:** When our prompts require observability coverage, the standard recommendation is OpenTelemetry + a backend of the team's choice (Prometheus, Jaeger, Datadog, etc.) — not a proprietary, lock-in solution.

---

## 10. Thoughtworks Technology Radar

### Technology Radar Vol 32 — Thoughtworks (Latest Edition)

**URL:** [https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2025/04/tr_technology_radar_vol_32_en.pdf](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2025/04/tr_technology_radar_vol_32_en.pdf)
**Published:** April 2025 — produced at the Technology Advisory Board meeting in Bangkok, February 2025

**What it says:** Thoughtworks' biannual publication produced by 21 senior technologists. Organises technologies into four rings (Adopt, Trial, Assess, Hold) across four quadrants (Techniques, Tools, Platforms, Languages & Frameworks). Vol 32 is the most current edition. Relevant entries for our project: Architecture Advice Process is in "Trial"; ADRs have graduated to baseline expectations and no longer appear on the radar; C4 model is established standard practice; OpenTelemetry is Adopt.

**What we use from this:** The single most authoritative source for what Thoughtworks currently considers best practice. Used to validate that all our chosen standards are active TW recommendations, not historical or outdated.

---

## Summary Table


| Practice                    | TW Status                       | Primary Reference                   | Used In                           |
| --------------------------- | ------------------------------- | ----------------------------------- | --------------------------------- |
| Lightweight ADRs            | Adopt (2018 — baseline)         | TW Tech Radar + Fowler              | All templates                     |
| Architecture Advice Process | Trial (April 2025)              | TW Tech Radar Vol 32                | ADR rationale                     |
| Fitness Functions           | Active (book 2022)              | Building Evolutionary Architectures | All NFR sections                  |
| Evolutionary Architecture   | Active (book 2022)              | Building Evolutionary Architectures | All decomposition guidance        |
| C4 Model                    | Standard practice               | c4model.com                         | All diagram generation            |
| Conway's Law                | Active (Fowler 2022)            | martinfowler.com                    | Team ownership in all templates   |
| Team Topologies             | Active (2nd ed Sep 2025)        | teamtopologies.com + TW podcast     | Team type classification          |
| Bounded Contexts / DDD      | Active (Fowler maintained)      | martinfowler.com                    | Decomposition in arc42 + C4       |
| Microservices Definition    | Active (Fowler 2014, canonical) | martinfowler.com                    | Container diagram guidance        |
| Monolith First              | Active (Fowler maintained)      | martinfowler.com                    | Architectural style justification |
| Strangler Fig               | Active (Fowler Aug 2024)        | martinfowler.com + TW article       | Transition plan sections          |
| Technical Debt Quadrant     | Active (Fowler maintained)      | martinfowler.com                    | Arc42 Section 11                  |
| Observability (3 pillars)   | Active (TW article)             | TW blog + OpenTelemetry Radar       | Crosscutting concerns             |
| OpenTelemetry               | Adopt (current radar)           | TW Tech Radar                       | Observability standard            |


---

*Last updated: June 2026*
*Maintained by the Vishwakarma AI team*