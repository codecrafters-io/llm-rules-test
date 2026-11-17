---
id: product_plain_name
severity: warn
summary: "Call the shipping product by its plain name, never 'real Redis' or 'Real Claude Code'."
---

## Rule
- Call the product by its plain name: "Redis supports", "Claude Code accepts".
- Do not use "real X" as a standing name for the product. Context already distinguishes it from the learner's version, and the qualifier implies theirs is the fake one.
- The comparative "just like the real Redis" is fine.
- Only applies when the challenge reproduces a shipping product.

## Good examples
- "Redis also accepts a `BIT` argument, which this challenge leaves out."
- "You'll implement a TCP server that listens on port 6379, just like the real Redis."

## Bad examples
- "Real Redis supports more options."
- "The real Claude Code sends the request differently."

## How to fix
- Drop the qualifier: "Redis supports more options."
