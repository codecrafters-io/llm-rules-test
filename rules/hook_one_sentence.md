---
id: hook_one_sentence
severity: error
summary: "Hook must be exactly one sentence (soft cap ≤160 chars)."
micro_prompt: >
  Judge ONLY this rule:
  Rule: HOOK_ONE_SENTENCE
  - The first paragraph ("hook") must be exactly one sentence.
  - Prefer ≤160 characters, but PASS if clearly one concise sentence.
  Return JSON: {"id":"hook_one_sentence","pass":boolean,"rationale":string,"suggested_fixes":string[]}
---

## Rule
The hook is the **first paragraph** and must be **exactly one sentence**. Soft cap: ≤160 chars.

## Good examples
- “In this stage, you’ll add a non-zero timeout to `BLPOP` so it returns a null array when the timer expires.”

## Bad examples
- “In this stage, you’ll add a non-zero timeout to `BLPOP`. We’ll also cover RESP arrays.”
- “We will implement `BLPOP` with timeout and discuss edge cases and testing and …” (run-on)

## How to fix
- Merge fragments into a single sentence and remove extra commentary.
