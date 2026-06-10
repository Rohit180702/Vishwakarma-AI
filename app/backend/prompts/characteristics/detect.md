SPECIFICATION:

{spec_text}

---

TASK: Analyze this specification and detect architectural characteristics (quality attributes) using evidence-based reasoning.

ANALYSIS PROCESS:

**Step 1: Read Specification Completely**

Read the entire specification carefully. Look for:
- Explicit non-functional requirements (NFRs) with numeric targets
- Compliance or regulatory requirements
- Technology choices that imply certain characteristics
- Business context (industry, company stage, user base)
- Functional requirements that imply quality attributes
- What is NOT mentioned (silence is data)

**Step 2: Identify Evidence**

For each potential characteristic, gather concrete evidence:

**EXPLICIT EVIDENCE (leads to high confidence 80-100%)**
```
Examples:
- "System must maintain 99.99% uptime" → Availability
- "Must be HIPAA compliant" → Compliance + Security + Privacy
- "Response time < 100ms for all API calls" → Performance
- "Support 10 million concurrent users" → Scalability
- "Must deploy multiple times per day" → Deployability
- "Budget: $5K/month" → Cost Efficiency
```

**IMPLICIT EVIDENCE (leads to medium confidence 50-79%)**
```
Examples:
- "Healthcare patient records system" → Security, Privacy, Compliance (domain-driven)
- "Real-time collaboration tool" → Performance (use case pattern)
- "Startup MVP" → Cost Efficiency, Time-to-Market (business context)
- "Global user base across 50 countries" → Scalability, Availability
- "Internal admin dashboard for 10 users" → Maintainability over Scalability
```

**WEAK HINTS (leads to low confidence 30-49%)**
```
Examples:
- "Should be fast" (no specific target) → Performance
- "Needs to be secure" (no specifics) → Security
- "Modern cloud architecture" (buzzword) → various
```

**Step 3: Apply Mark Richards' Framework**

Check if evidence supports any of these standard characteristics:

**Operational**: Availability, Performance, Scalability, Reliability, Recoverability, Robustness
**Structural**: Maintainability, Testability, Deployability, Modifiability, Extensibility
**Cross-Cutting**: Security, Observability, Privacy, Compliance, Auditability, Interoperability
**Business**: Cost Efficiency, Time-to-Market, Usability, Agility

**ONLY include characteristics where you found actual evidence.**

**Step 4: Assign Priority (1-10)**

Based on the strength of evidence and business criticality:

```
9-10 = Absolutely Critical
- Explicit compliance: "Must be HIPAA compliant"
- Extreme targets: "99.99% uptime", "p50 < 10ms"
- Business-critical domain: Payment system → Security 10

7-8 = Very Important
- Strong business need: "SaaS product" → Availability 8
- Good explicit targets: "99.9% uptime"
- Domain-driven: Healthcare → Privacy 8

5-6 = Important
- Mentioned but no targets: "Should be secure"
- Domain implied: "Web app" → Availability 6
- User expectations: "Fast response" → Performance 5

3-4 = Nice to Have
- Generic mention: "Should be maintainable"
- Industry baseline: Testability 3

1-2 = Minimal
- Barely relevant
- Explicitly deprioritized
```

**Step 5: Assign Confidence (0-100%)**

Be honest about certainty:

```
90-100% = Explicit in spec with numbers/compliance requirements
70-89% = Strong implicit signals from domain + requirements
50-69% = Reasonable inference from context
30-49% = Weak hint, could go either way
<30% = Do not include
```

**Step 6: Write Evidence-Based Rationale**

For each characteristic, write a **concise 2-3 sentence rationale**:
1. **What you found**: Cite specific spec content
2. **Why it matters**: How it shapes architecture for THIS system
3. **Keep it brief**: 2-3 sentences maximum, not paragraphs

**Step 7: Quality Check**

Before finalizing, verify:
- ✅ Every characteristic has specific evidence from spec
- ✅ Priority reflects business reality, not generic importance
- ✅ Confidence is honest (not inflated)
- ✅ Rationale explains THIS system (not generic)
- ✅ You detected 0-12 characteristics based on actual evidence (not trying to hit a count)
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
        "Business context: SaaS product where downtime directly impacts customer revenue"
      ],
      "rationale": "High availability is critical because paying customers depend on continuous access. 99.9% target requires redundancy, health checks, and automated failover. This will drive decisions around multi-region deployment, database replication, and monitoring infrastructure."
    }},
    {{
      "id": "cost_efficiency",
      "label": "Cost Efficiency",
      "priority": 8,
      "confidence": 75,
      "evidence": [
        "Spec mentions: 'Early-stage startup with limited runway'",
        "Implied constraint: No mention of enterprise budget or unlimited resources"
      ],
      "rationale": "As a startup, cloud costs must be carefully managed to extend runway. Architecture should favor managed services (reduce ops overhead) over custom infrastructure. Trade-offs will involve choosing cheaper options when they don't compromise the availability target. This is implied rather than explicit, hence confidence is 75%."
    }},
    {{
      "id": "security",
      "label": "Security",
      "priority": 7,
      "confidence": 85,
      "evidence": [
        "Spec states: 'Handle user authentication and payment data'",
        "Implied requirement: Payment data handling suggests PCI-DSS compliance needed"
      ],
      "rationale": "Payment data handling elevates security from baseline to high priority. Will require encrypted data at rest and in transit, secure authentication, tokenization of payment info, and likely PCI-DSS compliance assessment. Strong confidence due to explicit mention of payments, though spec doesn't state compliance requirement directly."
    }}
  ]
}}
```

CRITICAL RULES:

1. **Detect 0-12 characteristics** - whatever the evidence supports (0 is valid!)
2. **Rank by priority descending** in the output array
3. **Only include confidence ≥ 30%** - skip weak guesses
4. **Quote specific spec text** in evidence array whenever possible
5. **Explain reasoning** in rationale - teach the user what their spec implies
6. **Be honest about uncertainty** - don't inflate confidence scores
7. **Output pure JSON** - no markdown fences, no prose outside JSON

DETECTION STRATEGY:

**If spec is detailed with clear NFRs:**
→ Expect to detect 5-8 characteristics with high confidence

**If spec is moderate (some requirements, some gaps):**
→ Expect to detect 3-6 characteristics with mixed confidence

**If spec is vague (mostly functional requirements):**
→ Expect to detect 2-4 characteristics with lower confidence, relying on domain inference

**If spec provides almost no signals:**
→ Detect 0-2 characteristics with low confidence, or return empty array

**DO NOT force-fit characteristics just to produce a list.**

Remember:
- You're not guessing - you're analyzing evidence
- You're not completing a checklist - you're discovering what matters
- You're not being comprehensive - you're being precise
- Every characteristic you detect will drive architectural decisions

**Think like a Principal Architect reviewing this spec for the first time: What quality attributes will fundamentally constrain the architecture?**
