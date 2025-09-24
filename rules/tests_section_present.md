---
id: tests_section_present
severity: error
summary: "\"### Tests\" section must be present."
---

## Rule
- The document MUST contain a markdown heading exactly "### Tests".
- This rule only checks for presence (not contents).

## Good examples
- `### Tests`

## Bad examples
- Missing `### Tests`.
- Using a different heading like `## Tests` or `### Testing`.

## How to fix
- Add a level-3 heading exactly named `### Tests`.
