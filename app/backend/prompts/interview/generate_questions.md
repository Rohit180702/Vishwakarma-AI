SPECIFICATION:

{spec_text}

---

ESTABLISHED ARCHITECTURE CHARACTERISTICS:

The following quality attributes were already detected from the specification and confirmed by the
user. Treat them as established context — do NOT generate questions that ask about them again.
Instead, let them shape which gaps still need to be resolved.

{characteristics_context}

---

TASK: Analyze this specification and the established characteristics above, then generate the
minimum set of high-value architectural questions needed for HLD generation.

ANALYSIS PROCESS:

**Step 1: Deep Spec Analysis**
   - Read specification completely
   - Identify explicit requirements (clearly stated)
   - Identify implicit requirements (implied from context)
   - Mark ambiguous or unclear areas
   - Recognize what is architecturally critical but still unresolved

**Step 2: Cross-Reference with Established Characteristics**
   - For each established characteristic, check: does the spec already answer HOW to achieve it?
   - If a characteristic is established (e.g. Security priority 9) but the mechanism is unclear
     (e.g. auth model, data classification), that mechanism IS a valid question
   - Do not ask "how important is security?" — that is already answered
   - Do ask "what authentication mechanism aligns with your compliance constraints?" — that is a gap

**Step 3: Categorize Remaining Gaps**

   Apply the Tier prioritization defined in your system instructions (Tier 1 → Tier 3).
   Tier 1 gaps are asked first. Tier 3 gaps are only asked if they are still blocking HLD.

**Step 4: Determine Question Count**
   - Generate exactly the questions required to resolve the remaining gaps
   - If the spec and established characteristics together already answer a topic, skip it
   - A complete, detailed spec with fully established characteristics may need zero questions
   - Quality of questions determines HLD quality — not quantity

**Step 5: Generate Questions**
   - Each question targets ONE unresolved architectural decision
   - Each question must cite evidence from the spec that shows the gap
   - Skip any question whose answer will not change the resulting architecture

**Step 6: Generate Solution Options**
   - Provide the meaningful options that genuinely exist for this system and domain
   - Include specific benefits, risks, and trade-offs for each option
   - Mark the option best supported by the spec and established characteristics as recommended
   - Do not generate options that are unrealistic for this system's domain or constraints

OUTPUT FORMAT (strict JSON):

```json
{{
  "questions": [
    {{
      "id": "q1",
      "question": "<single, precise architectural decision question>",
      "why_critical": "<one sentence: which architectural component or decision depends on this answer>",
      "context_from_spec": "<what the spec says or does not say that creates this gap>",
      "evidence": [
        "<exact spec quote or reference that triggered this question>"
      ],
      "solutions": [
        {{
          "id": "sol1",
          "title": "<option name>",
          "description": "<1-2 sentences covering approach, benefit, and key trade-off>",
          "recommended": false
        }},
        {{
          "id": "sol2",
          "title": "<option name>",
          "description": "<1-2 sentences covering approach, benefit, and key trade-off>",
          "recommended": true
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

2. **Question Count Is Evidence-Driven**
   - Generate only the questions needed to produce a complete HLD
   - A minimal, focused set of high-impact questions is better than an exhaustive checklist
   - Each question must close a real gap — not satisfy a quota

3. **Each Question Must Have:**
   - Clear spec evidence citing the gap (not the answer)
   - A single, unambiguous decision to resolve
   - Why it matters stated as architectural impact
   - Options that represent genuine alternatives for this system

4. **Each Solution Must:**
   - Have a clear title and a concise description covering approach, benefit, and trade-off
   - Represent a distinct architectural approach — not a parameter variation
   - Be realistic and implementable for this system's domain

5. **Exactly ONE solution per question marked recommended**
   - Based on spec context, domain, and established characteristics
   - If characteristics establish a high priority (e.g. Security 9/10), the recommended option
     must be consistent with satisfying that characteristic

6. **Do not re-ask about established characteristics**
   - If a characteristic is listed as established, its importance is settled
   - Only ask about HOW to achieve it if the mechanism is genuinely unclear

Remember: The goal is the minimum information required to make the highest-quality architecture
decisions. If the spec and characteristics already answer a question, do not ask it.
