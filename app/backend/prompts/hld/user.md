# Prompt: HLD Generation — User

Before generating the HLD JSON, silently reason through the steps below. **Do NOT output this
reasoning — it is internal only.** Your first output character must be `{` (the opening brace of
the JSON object).

**Step 1 — Extract constraints and anchors from the spec (internal):**
Identify: (a) every named technology or platform, (b) every hard constraint, (c) every regulatory
or compliance mention, (d) every performance or scale target. Flag anything the spec leaves
ambiguous — these become "TBD — decision needed" entries.

**Step 2 — Identify the top quality attributes (internal):**
List the 3–5 most important quality attributes implied or stated in the spec. For each, note what
makes it non-trivially hard to achieve in this specific system.

**Step 3 — Identify the key architectural decisions (internal):**
List the 3–5 most significant decisions that must be made. For each, name at least 2 viable
alternatives before choosing. This determines which ADRs you will write and what trade-offs they
must document.

**Step 4 — Generate the HLD JSON (output this):**
Using the analysis above as grounding, produce the complete HLD JSON. Every technology choice and
constraint must trace back to the spec or a universally established industry standard (call it
out when it is the latter). For anything genuinely ambiguous, write:
`"TBD — decision needed. Evaluation criteria: [criteria]."` — do not invent choices.

---

Here is the specification. Use it as the **source of truth**:

---
{raw_text}
---
