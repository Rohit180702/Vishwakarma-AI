SPECIFICATION:

{spec_text}

---

TASK: Analyze this specification and generate the minimum set of high-value architectural questions needed for HLD generation.

ANALYSIS PROCESS:

**Step 1: Deep Spec Analysis**
   - Read specification completely
   - Identify explicit requirements (clearly stated)
   - Identify implicit requirements (implied from context)
   - Mark ambiguous or unclear areas
   - Recognize what's missing but architecturally critical

**Step 2: Categorize Gaps by Tier**

Tier 1 - Business Critical (MUST ask):
   - System boundaries, core domain
   - Scale expectations, availability requirements
   - Security posture, compliance needs

Tier 2 - Architecture Shaping (SHOULD ask):
   - Data architecture, integration strategy
   - Deployment model, performance requirements
   - Multi-tenancy, eventing patterns

Tier 3 - Optimization (COULD ask):
   - Caching, search, analytics
   - Observability, cost optimization

**Step 3: Determine Question Count**
   - Count Tier 1 + Tier 2 gaps
   - Add Tier 3 gaps only if needed
   - Guideline cap: ~20 questions maximum
   - Minimum: 0 questions (if spec is perfect)

Question count logic:
   - Excellent spec (no gaps) → 0-3 questions
   - Good spec (minor gaps) → 3-7 questions
   - Medium spec (moderate gaps) → 7-12 questions
   - Poor spec (many gaps) → 12-20 questions

**Step 4: Generate Questions**
   - Focus on highest impact decisions first
   - Only ask if answer materially changes architecture
   - Skip areas where spec is already clear
   - Ensure questions are independent when possible
   - Each question must cite evidence from spec

**Step 5: Generate Solution Options** (3-5 per question)
   - Each option must be realistic and implementable
   - Provide specific benefits, risks, and trade-offs
   - Mark ONE as recommended based on spec context
   - Solutions should represent genuine alternatives

OUTPUT FORMAT (strict JSON):

```json
{{
  "questions": [
    {{
      "id": "q1",
      "question": "What is your expected system latency requirement?",
      "why_critical": "Latency requirements fundamentally affect database choice, caching strategy, infrastructure design, API architecture, and cost structure. Different latency targets lead to dramatically different architectural patterns.",
      "context_from_spec": "You mentioned real-time processing on page 2 and fast user experience on page 5, but did not specify concrete latency targets or measurements.",
      "evidence": [
        "Page 2: system must support real-time processing",
        "Page 5: users expect fast and responsive interface"
      ],
      "solutions": [
        {{
          "id": "sol1",
          "title": "<100ms (Ultra-Low Latency)",
          "description": "Aggressive sub-100ms target for critical operations. High cost and complexity but exceptional user experience.",
          "recommended": false
        }},
        {{
          "id": "sol2",
          "title": "100-500ms (Balanced)",
          "description": "Standard web performance for most business apps. Cost-effective with proven patterns and good user experience.",
          "recommended": true
        }},
        {{
          "id": "sol3",
          "title": "500ms-2s (Simple)",
          "description": "Relaxed latency prioritizing simplicity and cost. Minimal cost but may not meet real-time expectations.",
          "recommended": false
        }}
      ]
    }}
  ]
}}
```

CRITICAL REQUIREMENTS:

1. **VALID JSON OUTPUT** (MOST IMPORTANT)
   - Output MUST be valid, parseable JSON
   - Escape ALL quotes inside strings (use backslash)
   - NO line breaks inside string values
   - NO apostrophes or use proper escaping
   - Test your JSON mentally before outputting

2. **Dynamic Question Count**
   - Generate only the questions needed for HLD (based on gaps)
   - Minimum: 0 questions (if spec is complete)
   - Maximum: ~20 questions (guideline, not strict)
   - Quality > Quantity

3. **Each Question Must Have:**
   - Clear spec evidence (cite exact quotes - escape quotes!)
   - Precise wording (one decision per question)
   - Why it matters (architectural impact - single line!)
   - 3-5 solution options

4. **Each Solution Format:**
   - Title: Clear, concise option name
   - Description: 1-2 sentences max covering benefits, risks, and trade-offs
   - No separate benefits/risks/tradeoffs arrays - keep it simple!
   - **Avoid overwhelming users with too much text**

5. **Exactly ONE solution per question marked as recommended**
   - Based on spec context and hints

6. **Questions must be evidence-based**
   - Every question must cite spec quotes (escape quotes!)
   - No generic checklist questions
   - Only ask if answer changes architecture

7. **Solutions must be genuinely different architectural choices**
   - Not just parameter variations
   - Each represents a distinct approach

FOCUS AREAS (if relevant to spec):

- System latency/performance requirements
- Scalability expectations (users, data, traffic)
- Data consistency vs availability trade-offs
- Security and compliance requirements
- Integration complexity and external dependencies
- Deployment and operational constraints
- Cost vs capability trade-offs
- Technology stack choices with architectural impact

Remember: Only ask questions where the answer significantly changes the architecture. If the spec is already clear, don't ask.
