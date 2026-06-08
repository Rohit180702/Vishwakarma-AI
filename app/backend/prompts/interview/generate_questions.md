SPECIFICATION DOCUMENTS:

{spec_text}

---

TASK: Generate exactly 6 critical architectural questions based on the specification above.

ANALYSIS PROCESS:

1. **Read Specification Completely**
   - Identify what is explicitly stated
   - Note what is implied or suggested
   - Mark what is ambiguous or unclear
   - Recognize what is missing but architecturally critical

2. **Identify Architectural Gaps**
   - What decisions can't be made confidently from the spec?
   - What has the biggest architectural impact?
   - What affects multiple system aspects?
   - What decisions unlock other decisions?

3. **Prioritize Questions** (Select exactly 6)
   - Focus on highest impact decisions
   - Prefer questions that are truly uncertain
   - Skip areas where spec is already clear
   - Ensure questions are independent when possible

4. **Generate Solution Options** (3-5 per question)
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
      "context_from_spec": "You mentioned 'real-time processing' on page 2 and 'fast user experience' on page 5, but didn't specify concrete latency targets or measurements.",
      "evidence": [
        "Page 2: 'system must support real-time processing'",
        "Page 5: 'users expect fast, responsive interface'"
      ],
      "solutions": [
        {{
          "id": "sol1",
          "title": "<100ms (Ultra-Low Latency)",
          "description": "Aggressive sub-100ms target for all critical operations, suitable for trading platforms, gaming, or real-time collaboration tools.",
          "benefits": [
            "Exceptional user experience with near-instant feedback",
            "Competitive advantage in latency-sensitive markets",
            "Suitable for real-time trading, gaming, or collaborative tools",
            "Meets highest user expectations"
          ],
          "risks": [
            "Significantly higher infrastructure costs (3-5x typical)",
            "Complex caching and optimization requirements",
            "Difficult to maintain consistency across distributed systems",
            "May over-engineer for actual business needs"
          ],
          "tradeoffs": [
            "High performance vs High cost",
            "Speed vs System complexity",
            "User experience vs Development timeline",
            "Real-time vs Eventual consistency"
          ],
          "recommended": false
        }},
        {{
          "id": "sol2",
          "title": "100-500ms (Balanced Performance)",
          "description": "Standard web application performance suitable for most business applications, e-commerce, and SaaS products.",
          "benefits": [
            "Cost-effective infrastructure (standard cloud services)",
            "Well-understood patterns and best practices",
            "Good user experience for typical applications",
            "Easier to maintain and scale",
            "Suitable for most business requirements"
          ],
          "risks": [
            "May not meet expectations if 'real-time' truly means <100ms",
            "Could face competitive disadvantage in speed-sensitive markets",
            "Users might perceive slight delays on slower connections"
          ],
          "tradeoffs": [
            "Moderate cost vs Good performance",
            "Standard complexity vs Proven patterns",
            "Balanced user experience vs Pragmatic implementation",
            "Suitable for 90% of use cases"
          ],
          "recommended": true
        }},
        {{
          "id": "sol3",
          "title": "500ms-2s (Conservative)",
          "description": "Relaxed latency target prioritizing simplicity, cost-effectiveness, and reliability over speed.",
          "benefits": [
            "Minimal infrastructure costs",
            "Maximum simplicity and maintainability",
            "Easier to achieve consistency and reliability",
            "Suitable for internal tools or low-frequency operations"
          ],
          "risks": [
            "Poor user experience for interactive applications",
            "Not suitable for 'real-time' requirements mentioned in spec",
            "May lead to user frustration and abandonment",
            "Competitive disadvantage in consumer markets"
          ],
          "tradeoffs": [
            "Low cost vs Slower performance",
            "Maximum simplicity vs User experience",
            "Only suitable for specific use cases (reporting, batch processing)"
          ],
          "recommended": false
        }}
      ]
    }}
  ]
}}
```

CRITICAL REQUIREMENTS:

1. Generate exactly 6 questions (no more, no less)
2. Each question must have 3-5 solution options
3. Each solution must have:
   - 3-5 specific benefits
   - 2-4 realistic risks
   - 2-4 concrete trade-offs
4. Exactly ONE solution per question marked as recommended
5. Questions must be based on evidence from the spec
6. Solutions must be genuinely different architectural choices

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
