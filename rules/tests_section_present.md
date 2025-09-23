---
id: tests_section_present
severity: error
summary: "\"### Tests\" section must be present."
micro_prompt: >
  Judge ONLY this rule:
  Rule: TESTS_SECTION_PRESENT
  - The document MUST contain a markdown heading exactly "### Tests".
  - This rule only checks for presence (not contents).
  Return JSON: {"id":"tests_section_present","pass":boolean,"rationale":string,"suggested_fixes":any[]}
---

## Rule
Include a `### Tests` section.

## Good examples
- `### Tests`

## Bad examples
- Missing `### Tests`.
- Using a different heading like `## Tests` or `### Testing`.

## How to fix
- Add a level-3 heading exactly named `### Tests`.
