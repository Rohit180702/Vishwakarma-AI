# Thoughtworks Technology Radar

> Thoughtworks' biannual map of what's worth using, what's worth trying, and what to avoid — produced by 21 senior technologists every six months.

---

## What It Is

The Tech Radar is a publication Thoughtworks produces twice a year. It's built from real client project experiences across hundreds of engagements globally. When something appears on the radar, it's not based on reading about it — it's based on teams actually using it and reporting back.

It covers four quadrants:

| Quadrant | What It Covers |
|---|---|
| **Techniques** | Practices and approaches (ADRs, Fitness Functions, Advice Process) |
| **Tools** | Software tools (OpenTelemetry, k6, Structurizr) |
| **Platforms** | Infrastructure and cloud platforms |
| **Languages & Frameworks** | Programming languages and frameworks |

Each item sits in one of four rings:

| Ring | Meaning |
|---|---|
| **Adopt** | Use this. It's proven at scale. No longer a question. |
| **Trial** | Worth using on a real project. Strong signal. |
| **Assess** | Worth exploring. Not ready to commit. |
| **Hold** | Proceed with caution. Known problems or better alternatives exist. |

---

## How Items Move Through the Radar

An item typically enters at **Assess**, moves to **Trial** as more teams validate it, and graduates to **Adopt** once it's proven across diverse project types.

Once an item reaches Adopt and stays there long enough, it sometimes **graduates off the radar entirely** — meaning it's no longer a question worth asking. It's become a baseline expectation.

**Example:** Lightweight ADRs reached Adopt in 2018 and have since graduated off. They no longer appear because the answer is settled — every project should use them. Asking "should we use ADRs?" is like asking "should we write tests?"

---

## The Vol 32 Positions (April 2025) Relevant to Us

| Practice | Ring | What It Means |
|---|---|---|
| **Lightweight ADRs** | Graduated (was Adopt) | Baseline expectation on every project |
| **Architecture Advice Process** | Trial | Validated, worth adopting on real projects |
| **C4 Model** | Established standard | No longer on radar — settled practice |
| **OpenTelemetry** | Adopt | De-facto standard for observability |

---

## What It's NOT

The Tech Radar is not a checklist of "use everything on this list." It's a **signal-to-noise filter**.

Engineering teams are constantly bombarded with new tools, frameworks, and practices — most of which are hype. The Tech Radar cuts through that noise by saying: "here's what has actually been validated at scale in real client projects by people who've seen a lot of projects."

Using it as a reference means you're not making architectural recommendations based on blog posts. You're making them based on validated, current practitioner experience.

---

## Why It Matters for Vishwakarma AI

The Tech Radar is our **validation source**. Every standard we've built into our prompts — ADRs, C4 Model, Fitness Functions, Evolutionary Architecture, Conway's Law, OpenTelemetry — has an active or graduated Tech Radar position.

From `architecture-standards.md`:
> "Used to validate that all our chosen standards are active TW recommendations, not historical or outdated."

When we say "we follow Thoughtworks standards" — the Tech Radar is the document that makes that claim verifiable and specific, not just a marketing phrase.

---

## Further Reading

- [Technology Radar Vol 32 — Thoughtworks (April 2025)](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2025/04/tr_technology_radar_vol_32_en.pdf) — latest edition (PDF)
- [Thoughtworks Tech Radar — interactive](https://www.thoughtworks.com/radar) — searchable, filterable online version
