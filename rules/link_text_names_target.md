---
id: link_text_names_target
severity: warn
summary: "Link text is the words in the sentence that name the target, not 'here' or 'the official documentation'."
---

## Rule
- Link the words already in the sentence that name what the link points to.
- Link text that names nothing fails: "here", "this", "this link", "click here", "read more", "docs", "the documentation", "the official introduction".
- Link text that names its target passes, even when it contains those words: "the Redis protocol docs".

## Good examples
- "It speaks the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)."
- "Use the [`RPUSH`](https://redis.io/docs/latest/commands/rpush/) command."

## Bad examples
- "You can read more about it [here](https://example.com)."
- "See [the official introduction](https://example.com)."

## How to fix
- Move the link onto the name of the thing: "[RESP arrays](https://example.com) are …".
