---
id: hook_one_sentence
severity: error
summary: "Hook must be exactly one sentence (soft cap ≤160 chars)."
---

## Rule
- The hook is the text before the first heading and must be **exactly one sentence**. 
- If no headings, the whole document is the hook.
- Soft cap: ≤160 chars (guideline, not hard fail if it’s one concise sentence).

## Good examples

* “In this stage, you’ll implement support for the PING command.”

## Bad examples

* “In this stage, you’ll implement support for the PING command. We’ll also discuss RESP arrays.” (two sentences)
* Starting with a heading and no paragraph before it.

## How to fix

* Keep only one sentence in the first paragraph; move any extra sentences into an Explanation section.
