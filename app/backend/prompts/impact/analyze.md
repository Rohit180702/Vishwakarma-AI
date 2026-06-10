ANALYSIS REQUEST:

## User's Prioritized Characteristics

{characteristics_json}

## Interview Question

**Question ID**: {question_id}

**Question**: {question_text}

**Why This Question Is Critical**: {why_critical}

**Context from Spec**: {context_from_spec}

## Solution Options

### Recommended Solution (AI-Suggested)
**ID**: {recommended_solution_id}
**Title**: {recommended_solution_title}
**Description**: {recommended_solution_description}

### User's Chosen Solution
**ID**: {chosen_solution_id}
**Title**: {chosen_solution_title}
**Description**: {chosen_solution_description}

---

## Task

Analyze how the user's chosen solution compares to the recommended solution, specifically in terms of their prioritized architectural characteristics.

**Focus on**:
1. Why was the recommended solution suggested based on their top 3 characteristics?
2. How does the user's choice affect each of their prioritized characteristics?
3. What is the severity of this deviation? (low/moderate/high)
4. What's the architectural trade-off principle at play?

**Output pure JSON** (no markdown fences):

```json
{{
  "severity": "low | moderate | high",
  "affected_characteristics": [
    {{
      "characteristic_id": "string",
      "characteristic_label": "string",
      "user_priority": number (1-10),
      "impact": "positive | negative | neutral",
      "magnitude": "minor | moderate | major",
      "reasoning": "Specific technical explanation with concrete details"
    }}
  ],
  "summary": "1-2 sentence summary for modal display",
  "recommendation_rationale": "Why the recommended solution was chosen based on their priorities",
  "tradeoff_insight": "The architectural principle/trade-off being made"
}}
```

**Rules**:
- Only include characteristics that are actually affected (typically 2-4)
- Focus on top 5 characteristics - ignore lower priorities unless significantly impacted
- Be specific and technical, not generic
- Quantify when possible ("60% cost reduction", "adds 50ms latency")
- If the chosen solution IS the recommended one, return severity="low" with neutral impacts
