---
id: notes_max_three_bullets
severity: warn
summary: "If \"### Notes\" exists, it must contain ≤ 3 bullet points (bullets may be multi-sentence)."
micro_prompt: >
  Judge ONLY this rule:
  Rule: NOTES_MAX_THREE_BULLETS
  - If there is no "### Notes" section, PASS (not applicable).
  - If "### Notes" exists, it should have 3 bullet points at most - remember that each bullet point can be multiple sentences
  Return JSON: {"id":"notes_max_three_bullets","pass":boolean,"rationale":string,"suggested_fixes":any[]}
---

## Rule
Keep `### Notes` concise: ≤ 3 bullets. Bullets can be multi-sentence.
