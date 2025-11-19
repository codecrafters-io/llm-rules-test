---
id: stage_references_plural
severity: error
summary: "When referring to other stages, use flexible plural phrasing. Do not name specific stages or use singular next previous."
---

## Rule

- This rule applies only to references to other stages, not the current stage.
- For other stages, use plural phrasing: “earlier stages,” “previous stages,” “later stages,” “future stages,” “subsequent stages.”
- Do not use “Stage 2,” “the next stage,” “the previous stage,” “in the next stage,” “in the previous stage,” etc.
- Ignore text inside code fences, inline code, file paths, and explicit filenames.

## Good examples

- "For this stage, you'll work on RESP strings."
- “You will parse RESP arrays in later stages.”
- “Connection pooling is covered in subsequent stages.”
- “Input validation was introduced in earlier stages.”

## Bad examples

- “You will parse RESP arrays in Stage 2.”
- “Connection pooling is covered in the next stage.”
- “Input validation was handled in the previous stage.”

## How to fix

- Replace singular or numbered references to other stages with plural phrasing.

  - “the next stage” → “later stages”
  - “the previous stage” → “earlier stages” or “previous stages”
  - “Stage 2” → “earlier stages” or “later stages” depending on context
