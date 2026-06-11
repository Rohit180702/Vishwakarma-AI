SPECIFICATION:

{spec_text}

---

TASK: Analyze this specification and detect architectural characteristics (quality attributes)
using the evidence-based reasoning principles defined in your system instructions.

ANALYSIS PROCESS:

**Step 1: Read Specification Completely**

Read the entire specification carefully. Look for:
- Explicit non-functional requirements (NFRs) with numeric targets
- Compliance or regulatory requirements
- Technology choices that imply certain characteristics
- Business context (industry, company stage, user base)
- Functional requirements that imply quality attributes
- What is NOT mentioned (silence is data)

**Step 2: Gather Evidence Per Characteristic**

For each candidate characteristic, classify your evidence before including it:

EXPLICIT (high confidence) — the spec states it directly:
- Numeric targets, SLA commitments, compliance mandates, explicit technology constraints,
  stated budget or timeline constraints
- Example: "The system must maintain 99.9% uptime" or "Must be GDPR compliant"

IMPLICIT (medium confidence) — the spec implies it through functional requirements,
use-case patterns, stated user scale, or business context:
- The functional requirement or business context IS the evidence — cite it exactly
- Example: "The system processes payment transactions" implies security and likely compliance;
  cite the payment mention, not a domain assumption

WEAK HINT (low confidence) — a vague adjective, a generic aspiration, or an industry baseline:
- Include only if the characteristic materially shapes architectural decisions even at this
  vague level
- Example: "Should be easy to maintain" with no further elaboration

IMPLICIT (always present, confidence reflects level not applicability) — Richards & Ford's
framework defines implicit characteristics as architectural obligations of any production system,
regardless of whether the spec author stated them. These must always be detected when the spec
describes a functional system:
- Availability: the system must be available to serve its purpose
- Reliability: the system must behave correctly under normal conditions
- Security: any system with users, data, or network exposure has a baseline obligation
Assign confidence and priority based on how much the functional requirements reveal about the
required LEVEL (e.g. "processes payments" implies a higher security level than "internal notes").
Always cite the functional requirement as evidence — never just the domain name.

NO EVIDENCE → return implicit baseline only. An empty list is valid only if the input has
no description of what the system does at all — which should not occur in practice.

**Step 3: Apply Mark Richards' Framework + Evolutionary Architecture Lens**

Use the taxonomy from your system instructions to name the characteristic correctly:

Operational: Availability, Performance, Scalability, Reliability, Recoverability, Robustness
Structural: Maintainability, Testability, Deployability, Modifiability, Extensibility, Evolvability
Cross-Cutting: Security, Observability, Privacy, Compliance, Auditability, Interoperability
Business: Cost Efficiency, Time-to-Market, Usability, Agility

In addition, always consider whether the evidence supports these **evolutionary architecture**
characteristics — they are frequently implicit and shape the HLD significantly:

- **Independent Deployability** — can services be released without coordinating with other teams?
  Evidence signals: multiple teams mentioned, separate release cycles, micro-frontend or microservices intent
- **Team Cognitive Load** — how much complexity will each owning team absorb?
  Evidence signals: team size mentioned, "single team owns X", monolith vs distributed statements
- **Fitness Function Coverage** — can key quality attributes be verified automatically?
  Evidence signals: SLA numbers, performance budgets, security compliance mandates — any measurable goal
- **Deployment Frequency** — how often must changes reach production?
  Evidence signals: "continuous delivery", "rapid iteration", "release every sprint", startup stage

If any of these are present in the evidence, include them as named characteristics
(use id: "independent_deployability", "team_cognitive_load", "fitness_function_coverage", "deployment_frequency").

Only include characteristics where you found actual evidence in this specification.

**Step 4: Assign Priority and Confidence**

Use the priority assignment rules and confidence thresholds from your system instructions.
Reason from the evidence you collected in Step 2 — do not assign priority by domain pattern.
The key question for priority: "How much will this characteristic constrain architectural
decisions — if we ignore it, does the architecture fail?"

**Step 5: Write Evidence-Based Rationale**

For each characteristic, write TWO fields:

- `summary`: ONE sentence, maximum 15 words. The plain-language reason this characteristic matters for this system. No jargon.
  - Good: "Payment data storage requires PCI-DSS-level encryption and access control."
  - Bad: "Security is important for systems handling sensitive data."

- `rationale`: 2-3 sentences of architectural reasoning:
  1. What you found in the spec — cite the exact text or describe the evidence type
  2. Why it shapes architecture for THIS system specifically
  3. What would change architecturally if this characteristic were ignored

**Step 6: Quality Check**

Before outputting, verify:
- ✅ Implicit characteristics (availability, reliability, security) are present unless
  the input has no system description at all
- ✅ Every characteristic cites a functional requirement or spec quote — not a domain label
- ✅ Priority reflects how much this characteristic constrains the architecture for THIS system
- ✅ Confidence reflects certainty about the required LEVEL, not whether the characteristic applies
- ✅ Rationale explains THIS system specifically — not a generic system of this type
- ✅ You have not padded the list with characteristics that would not change any design decision
- ✅ Output is valid JSON

OUTPUT FORMAT (strict JSON):

```json
{{
  "characteristics": [
    {{
      "id": "availability",
      "label": "Availability",
      "priority": 9,
      "confidence": 92,
      "evidence": [
        "Spec explicitly states: '99.9% uptime required' (section 3.2)",
        "Spec states: 'downtime directly causes customer churn and revenue loss'"
      ],
      "summary": "99.9% SLA with business consequences drives redundancy and multi-zone deployment.",
      "rationale": "The spec commits to a 99.9% uptime SLA with explicit business consequence for failure. This drives redundancy, automated failover, health monitoring, and multi-zone deployment decisions. Without treating this as a hard constraint, the database and service topology choices cannot be finalized."
    }},
    {{
      "id": "security",
      "label": "Security",
      "priority": 7,
      "confidence": 80,
      "evidence": [
        "Spec states: 'The system handles user authentication and stores payment card data'",
        "Implied: payment card data storage requires PCI-DSS assessment — spec does not state compliance explicitly"
      ],
      "summary": "Payment card storage demands PCI-DSS-level encryption, tokenization, and access controls.",
      "rationale": "Payment card data storage elevates security from baseline to high priority. Encryption at rest and in transit, tokenization of card data, and access control are architectural requirements. Confidence is 80% rather than higher because the spec mentions the data type but does not state a compliance mandate directly."
    }}
  ]
}}
```

CRITICAL RULES:

1. **Evidence determines the list** — detect as many characteristics as the evidence supports.
   There is no target count. An empty list is correct if the spec has no signals.
2. **Rank by priority descending** in the output array
3. **Only include confidence ≥ 30%** — weaker inferences are not actionable
4. **Quote specific spec text** in the evidence array; name the evidence type when paraphrasing
5. **Explain reasoning** in the rationale — what architectural decision does this drive?
6. **Be honest about uncertainty** — if you are inferring, say so and reflect it in confidence
7. **Output pure JSON** — no prose, no markdown fences outside the JSON block
