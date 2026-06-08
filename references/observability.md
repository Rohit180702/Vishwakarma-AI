# Observability & OpenTelemetry

> Know what your system is doing from the outside — before someone calls you at 2am.

---

## The Problem It Solves

Your system is deployed. Something goes wrong at 2am. An alert fires. An engineer opens their laptop and asks: **"What is happening and why?"**

If you can't answer that question quickly from the data your system produces — you don't have observability. You have a black box.

Observability is the property of a system that makes it possible to understand what it's doing **from the outside**, purely from the outputs it emits.

Three types of output. Three pillars.

---

## Pillar 1 — Logs

**What they are:** Timestamped records of every event that happened.

Logs are a diary. Every time something significant happens, the system writes a line.

**Plain text logs (wrong):**
```
Payment processed for user 4821, amount 249.99 INR, took 143ms
```
Readable, but not queryable. You can't ask "show me all payments over 500ms" without writing a regex.

**Structured logs (right):**
```json
{
  "timestamp": "2026-06-07T08:32:01Z",
  "level": "INFO",
  "service": "payment",
  "user_id": "u-4821",
  "amount": 249.99,
  "currency": "INR",
  "duration_ms": 143,
  "trace_id": "abc123"
}
```
Every field is a key-value pair. Now you can filter, aggregate, and query across millions of log lines instantly.

**Correlation IDs:** Every request gets a unique ID at the entry point (API Gateway). Every log written anywhere in that request's journey carries the same ID. When something fails, you search by the correlation ID and see every log from every service involved — in order.

---

## Pillar 2 — Metrics

**What they are:** Numbers that tell you if the system is healthy right now.

Logs tell you what happened. Metrics tell you **how the system is performing in aggregate.**

```
http_requests_total{status="200"}   → how many successful requests
http_requests_total{status="500"}   → how many errors
http_request_duration_p99           → slowest 1% of requests: how long?
active_connections                  → how many open connections right now?
queue_depth                         → how many messages waiting to be processed?
```

These numbers update continuously. Put them on a dashboard. Set alerts:

> "If error rate exceeds 1% for 5 minutes → page the on-call engineer."

Logs without metrics is like reading a diary to figure out if someone is sick. Metrics are the vital signs — a monitor beeping in the background. One glance tells you if something is wrong.

---

## Pillar 3 — Traces

**What they are:** The full journey of a single request across all services.

In a monolith, one request touches one codebase. Easy to follow. In microservices, one user clicking "Buy" might touch 8 services:

```
User clicks Buy
→ API Gateway        (2ms)
→ Order Service      (15ms)
  → Inventory        (45ms)   ← slow?
  → Payment Service  (200ms)
    → Fraud Detection (180ms) ← actual bottleneck
→ Notification       (8ms)
Total: 450ms
```

Without tracing: you see the total request took 450ms. You have no idea why.

With tracing: you see Fraud Detection consumed 180ms of that. You know exactly where to look.

A trace records the full call tree — how long each hop took, which service called which, where time was spent.

---

## OpenTelemetry — The Standard

OpenTelemetry is the industry standard that covers all three pillars under one framework.

**Before OpenTelemetry:**
- Datadog: install Datadog's SDK
- New Relic: install New Relic's SDK
- Switch vendors → rewrite all instrumentation across every service

**With OpenTelemetry:**
- Instrument once using the OpenTelemetry SDK
- Data goes to an OpenTelemetry Collector
- Collector forwards to any backend: Datadog, Prometheus, Jaeger, Grafana — anything

Switch vendors → change one config line. Zero code changes.

Thoughtworks moved OpenTelemetry to **"Adopt"** — their strongest recommendation. It is the de-facto standard for telemetry in distributed systems.

---

## Why Observability Matters for HLD Generation

Observability is a **crosscutting concern** — it affects every service in the system, not just one component.

The failure pattern: teams design the happy-path architecture perfectly, ship it, and when something breaks in production they have no way to diagnose it. They start adding logging and metrics after the fact, inconsistently, across services. Each service logs differently. Nobody can correlate events. The on-call engineer is blind.

**A good HLD defines the observability strategy upfront** so every team implements it the same way from day one.

---

## How We Use It in Vishwakarma AI

**In `system.arc42.md` — Section 8 (Crosscutting Concepts) — mandatory:**
```
"Address all of: authentication pattern, authorisation model, error response
format, structured logging + correlation IDs, secrets management,
distributed tracing, API versioning, data validation approach."
```

**In `system.rfc.md` — Section 5 (Cross-Cutting Concerns):**
```
"Observability: structured logging format, key metrics instrumented,
distributed tracing approach, alerting strategy.

Security, privacy, and observability are never optional appendices."
```

The LLM cannot generate an HLD that skips observability. It is mandatory in every template.

**What the generated output looks like:**

Instead of:
> "We will add logging to the system."

The generated HLD says:
> "**Structured logging:** All services emit JSON logs with fields: `timestamp`, `level`, `service`, `trace_id`, `user_id` (when present), `duration_ms`. Correlation IDs injected at API Gateway, propagated via `X-Trace-ID` header across all service calls.
>
> **Metrics:** Prometheus-format metrics exposed at `/metrics` on each service. Key metrics: `http_requests_total`, `http_request_duration_seconds`, `db_query_duration_seconds`. Grafana dashboards per service. Alert: error rate > 1% for 5 minutes → PagerDuty.
>
> **Distributed tracing:** OpenTelemetry SDK in all services. OTLP export to Jaeger (dev) / Datadog APM (prod). Trace sampling: 100% errors, 10% success paths."

---

## Further Reading

- [Observability as a Leadership Choice — Thoughtworks](https://www.thoughtworks.com/insights/blog/technology-strategy/drowning-in-dashboards-starving-for-clarity-why-observability-is-a-leadership-choice)
- [OpenTelemetry — Thoughtworks Tech Radar](https://www.thoughtworks.com/radar/languages-and-frameworks/opentelemetry) — current Adopt status
- [OpenTelemetry Official Site](https://opentelemetry.io/) — SDK, Collector, OTLP protocol
