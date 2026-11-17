---
id: hook_one_sentence
severity: error
summary: "The hook has exactly one action sentence, optionally after one or two sentences of context (soft cap ≤160 chars for the action sentence)."
---

## Rule
- The hook is the text before the first heading. A collapsed `<details>` block after it does not count.
- If no headings, the whole document is the hook.
- The hook has **exactly one action sentence**: "In this stage, you'll implement/add/handle X."
- The hook takes one of two forms:
  1. The action sentence alone.
  2. One or two sentences of context that say what the thing is, followed by the action sentence.
- Nothing follows the action sentence.
- Soft cap: ≤160 chars for the action sentence (guideline, not hard fail if it's concise).

## Good examples

* “In this stage, you’ll implement support for the PING command.”
* “Every shell starts with a prompt (usually `$`) that signals it’s ready for your command. In this stage, you’ll print that prompt.”

## Bad examples

* “In this stage, you’ll implement support for the PING command. We’ll also discuss RESP arrays.” (a sentence after the action sentence)
* Three or more sentences of context before the action sentence.
* A hook with no “In this stage, you’ll …” sentence.
* Starting with a heading and no paragraph before it.

## How to fix

* End the hook on the action sentence, and move anything after it into an Explanation section.
* Keep context to one or two sentences, and move the rest into an Explanation section.
