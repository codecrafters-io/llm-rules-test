---
id: hook_one_sentence
severity: error
summary: "Hook must be exactly one sentence (soft cap ≤160 chars)."
micro_prompt: >
  Judge ONLY this rule.
  - Fetch all heading levels (### Section).
  - Fetch the first heading you find and the first sentence after it.
  - Fetch and state the text before the first heading.
  - The hook is the first text as defined above and must be exactly one sentence.
  - It should plausibly be <= 200 characters (soft cap).

  Return JSON: {"id":"hook_one_sentence","pass":boolean,"rationale":string,"suggested_fixes":string[]}
---

## Rule
The hook is the first paragraph as defined above and must be exactly one sentence. Soft cap: ≤160 chars.

## Good examples
- “In this stage, you’ll implement support for the PING command.”

## Bad examples
- “In this stage, you’ll implement support for the PING command. We’ll also discuss RESP arrays.” (two sentences)
- Starting with a heading and no paragraph before it.

## How to fix
- Keep only one sentence in the first paragraph; move any extra sentences into an Explanation section.
