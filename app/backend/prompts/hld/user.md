# Prompt: HLD Generation — User

Before generating the HLD JSON, silently reason through the steps below. **Do NOT output this
reasoning — it is internal only.** Your first output character must be `{` (the opening brace of
the JSON object).

**Step 0 — Process interview decisions (internal):**
The specification may contain an "Architectural Decisions (from Interview)" section.
Process it before everything else:

- Answers **without** `*(default recommendation)*` are **explicit user decisions** — the user
  consciously chose this option. Treat these as hard constraints. If an ADR must depart from one,
  the ADR `context` field MUST acknowledge this with:
  `"⚠️ This decision departs from the interview answer of [X]. Reason: [reason]."`

- Answers **with** `*(default recommendation)*` are **accepted suggestions** — the user accepted
  the system recommendation without actively validating it. Use them as weighted guidance and
  apply your own architectural judgment. If you override one, no special acknowledgment is needed.
  If you use one as the basis for an ADR, its context should note it was an accepted recommendation.

- Where an explicit user decision **conflicts with the original specification text**, surface this
  in the relevant ADR context as:
  `"⚠️ The spec states [X] but the interview answer was [Y]. Architecture is based on [chosen]."`

**Step 1 — Extract constraints and anchors from the spec (internal):**
Identify: (a) every named technology or platform, (b) every hard constraint, (c) every regulatory
or compliance mention, (d) every performance or scale target. Flag anything the spec leaves
ambiguous — these become "TBD — decision needed" entries.

**Step 2 — Load quality attributes from established characteristics (internal):**
The spec may contain an "Architecture Characteristics (User-Prioritized)" section. If present,
use those characteristics directly — they were detected from the spec with evidence and confirmed
by the user. Do NOT re-derive or contradict them.

- Use high-priority characteristics (priority ≥ 7) as hard architectural constraints: every
  major decision must explicitly account for them.
- Use medium-priority characteristics (priority 4–6) as design quality targets.
- Use low-priority characteristics (priority ≤ 3) as aspirational but non-blocking.

If no characteristics section is present, derive the dominant quality attributes from the spec
and note them as inferred (not user-confirmed).

**Step 3 — Identify the key architectural decisions (internal):**
List the 3–5 most significant decisions that must be made. For each, name at least 2 viable
alternatives before choosing. This determines which ADRs you will write and what trade-offs they
must document.

**Step 4 — Generate the HLD JSON (output this):**
Using the analysis above as grounding, produce the complete HLD JSON. Every technology choice and
constraint must trace back to the spec or a universally established industry standard (call it
out when it is the latter). For anything genuinely ambiguous, write:
`"TBD — decision needed. Evaluation criteria: [criteria]."` — do not invent choices.

**Mermaid sequenceDiagram — strict syntax rules (Mermaid v11):**
These are hard rules. Violating any one will cause a parse error in the renderer.

- NEVER use curly braces or angle brackets in any message label or note text.
  BAD:  `Client->>API: GET /events/:id_in_curly_braces`  (curly braces around path params)
  GOOD: `Client->>API: GET /events/id`
  BAD:  `Service->>DB: INSERT record_in_angle_brackets`  (angle bracket wrappers)
  GOOD: `Service->>DB: INSERT record`
  Allowed characters in labels: letters, digits, spaces, underscores, hyphens,
  forward-slashes, colons, dots, parentheses.

- NEVER place a `Note over` statement inside an `alt`, `else`, `opt`, or `loop` block.
  Move all notes to OUTSIDE these blocks (before or after).
  BAD:
    ```
    alt success
      Note over Service: logged
    end
    ```
  GOOD:
    ```
    alt success
      Service->>Client: 200 OK
    end
    Note over Service: logged
    ```

- Participant names must be a single word. Use `snake_case` — no spaces, hyphens, or
  special characters.
  BAD:  `participant API-Gateway`
  GOOD: `participant API_Gateway`

- Every `alt`, `opt`, and `loop` block MUST be closed with a matching `end`.

- Message label text: use only letters, digits, spaces, underscores, hyphens,
  forward-slashes, colons, dots, and parentheses. Nothing else.

---

Here is the specification. Use it as the **source of truth**:

---
{raw_text}
---
