---
id: section_order
severity: error
summary: "Sections must appear in order: Explanation section(s) → ### Tests → optional ### Notes."
micro_prompt: >
  Judge ONLY this rule:
  Rule: SECTION_ORDER
  - After the hook, there must be one or more titled explanation sections.
  - Then exactly one "### Tests" section.
  - Then optional "### Notes" section.
  - Any other order FAILS.
  Return JSON: {"id":"section_order","pass":boolean,"rationale":string,"suggested_fixes":any[]}
---

## Rule
Order is strict: **Explanation section(s)** → **### Tests** → (optional) **### Notes**.

## Good examples
- `### Understanding BLPOP Timeouts` … → `### Tests` … → *(no Notes)*.
- Multiple explanation sections before `### Tests`.

## Bad examples
- `### Tests` before any explanation.
- `### Notes` appearing before `### Tests`.

## How to fix
- Move/rename sections to match the required order.
