---
id: no_internal_terms
severity: error
summary: "No CodeCrafters internal terms in learner-facing text: name the concept the learner built instead."
---

## Rule
- Do not use internal terms such as "Stage 1", "Stage 2", "base course", "base stages", or "extension stage".
- Learners remember the concepts they built, not stage numbers or internal names. Name the concept instead.
- Text inside code blocks and inline code is not checked.

## Good examples
- "Use the Read tool you added in earlier stages."
- "You'll count those bytes with `BITCOUNT` in later stages."

## Bad examples
- "Keep the client initialization from Stage 1."
- "The base course never creates a system prompt."
- "This extension stage builds on the base stages."

## How to fix
- Replace the stage number or internal name with what the learner built: "the client you connected in earlier stages". Keep the reference plural, as `stage_references_plural` requires.
