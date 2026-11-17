---
id: stage_length
severity: warn
summary: "A stage is about 500 words of prose at most. Longer is called out, not failed."
---

## Rule
- Count the prose a learner has to read to pass. Leave out code blocks and other languages' `{{#lang_is_<language>}}` blocks.
- About 500 words is the guideline. A longer stage is worth a second look: it may be two stages, or carry background that belongs elsewhere.
- There is no minimum. A first stage can be a few sentences.
- Pass when the prose is about 500 words or fewer. Fail only when it is clearly longer, around 600 words or more.

## Good examples
- A stage with 280 words of prose and three code blocks.
- A first stage of two sentences followed by `### Tests`.

## Bad examples
- A stage with 940 words of prose that teaches nine new ideas.

## How to fix
- Ask whether the stage is two stages. If it is one, cut what repeats an earlier section or an earlier stage.
