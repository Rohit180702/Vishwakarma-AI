# C4 Model for Architecture Diagrams

> A standard set of zoom levels for drawing software architecture diagrams — so everyone in the room is looking at the same thing.
> Source: [c4model.com](https://c4model.com/introduction) — created by Simon Brown, actively maintained

---

## The Problem It Solves

When architects draw diagrams, they use different shapes and notations. When developers draw them, they look completely different. When a BA draws one, it's different again.

You end up with a room full of people staring at a diagram arguing about what the boxes mean, instead of talking about the actual architecture.

**C4 gives everyone the same vocabulary and zoom levels.**

---

## The Core Idea — Map Zoom Levels

Think of Google Maps. The same city looks different at different zoom levels:

- Zoomed out → countries, borders, major roads
- Zoom in → cities and highways
- Zoom in more → streets and buildings
- Zoom in fully → individual rooms inside a building

C4 does the same for software. Four levels, four zoom levels.

---

## Level 1 — Context Diagram (Most Zoomed Out)

**Audience:** Everyone — business stakeholders, managers, non-technical people.

**What it shows:** Your entire system as a single box. Who uses it. What external systems it connects to.

**What it does NOT show:** Any technology. No databases, no frameworks, no services inside the system.

**Example:**
```
[Person: Customer]  →  [Software System: Online Banking]  →  [Software System: Payment Gateway]
                                       ↓
                           [Software System: Email Service]
```

**Rules:**
- Maximum 10 elements
- No technology terms (no "PostgreSQL", no "React", no "Kubernetes")
- Every arrow must have a label saying what flows across it

---

## Level 2 — Container Diagram (Zoom In Once)

**Audience:** Technical people — developers, architects, DevOps.

**What it shows:** Every separately deployable unit inside your system. A "container" means anything you can deploy independently — a web app, a mobile app, a database, an API, a message queue.

**Example:**
```
[Container: React SPA]
    ↓ REST/HTTPS
[Container: Node.js API]  →  [Container: PostgreSQL 16]
         ↓ Redis protocol
[Container: Redis 7 : session cache]
```

**Key rules:**
- Technology annotation is mandatory: `[Container: PostgreSQL 16]`, not just `[Database]`
- Every arrow must include the protocol: REST/HTTPS, gRPC, AMQP, WebSocket
- Maximum 15 elements
- No classes or functions — those are internal implementation details

This is the most useful diagram in practice. It answers: "what are the moving parts and how do they talk to each other?"

---

## Level 3 — Component Diagram (Zoom In Again)

**Audience:** Developers working on one specific container.

**What it shows:** The internal structure of one container — its major components, modules, or services.

**Example (inside the Node.js API container):**
```
[Component: Auth Controller]   →  [Component: JWT Service]
[Component: Order Controller]  →  [Component: Order Repository]  →  [Container: PostgreSQL 16]
```

This is optional — only draw it when a specific container is complex enough to need explanation.

---

## Level 4 — Code Diagram (Fully Zoomed In)

**Audience:** Individual developers.

**What it shows:** Class diagrams, function relationships — actual code structure.

In practice, almost nobody draws this manually. IDEs generate it automatically. **Thoughtworks recommends skipping Level 4 entirely.**

---

## The Bracket Notation

Every element must declare its type in brackets. This removes all ambiguity:

```
[Person: Customer]
[Software System: Payment Gateway]
[Container: PostgreSQL 16]
[Container: React SPA]
[Component: Auth Service]
```

You can never look at a C4 diagram and wonder "is that box a person or a service?"

---

## A Complete Container Diagram Example

```
[Person: Customer]
    ↓ HTTPS
[Container: React SPA]
    ↓ REST/HTTPS
[Container: API Gateway : Node.js + Express]
    ↓ gRPC                         ↓ AMQP
[Container: Order Service]    [Container: Notification Service]
    ↓ SQL                              ↓ SMTP
[Container: PostgreSQL 16]    [Software System: SendGrid]
    ↓
[Container: Redis 7 : session cache]
```

Every box has a type. Every arrow has a protocol. Hand this to any engineer anywhere and they'll understand it immediately.

---

## Why Thoughtworks Endorses It

Before C4, architecture diagrams were inconsistent. UML was the formal standard but too complex for mixed-skill audiences. Ad-hoc "boxes and lines" were inconsistent between teams.

C4 is the middle ground — structured enough to be consistent, simple enough for everyone to read.

---

## How It's Used in Vishwakarma AI

C4 is directly implemented in our diagram generation:

| C4 Rule | Our Implementation |
|---|---|
| Bracket notation with type declared | Every generated node follows `[Type: Name]` format |
| Protocol on every arrow | Edge labels include REST/HTTPS, gRPC, AMQP, etc. |
| Level 1 Context + Level 2 Container | Both levels always generated |
| Element count limits | ≤10 for Context, ≤15 for Container — enforced in prompts |
| Technology annotations mandatory | Container names include version where relevant |

The generated React Flow diagrams on the Diagram tab are a visual rendering of a C4 Container diagram.

---

## Further Reading

- [C4 Model — Official Site](https://c4model.com/introduction) — Simon Brown's reference, actively maintained
- [C4 Model — Structurizr DSL](https://structurizr.com/) — tool for generating C4 diagrams as code
- [Thoughtworks on C4](https://www.thoughtworks.com/radar) — endorsed as standard practice for communicating architecture to mixed-skill stakeholders
