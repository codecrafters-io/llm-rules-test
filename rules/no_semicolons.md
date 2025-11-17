---
id: no_semicolons
severity: error
summary: "Text outside code blocks/inline code must not contain semicolons."
---

## Rule
- Do not use semicolons (`;`) in normal prose.  
- Semicolons are allowed inside fenced code blocks (``` … ```), inline code spans (``like this;``), or HTML code (```<div style="color: black;" />```).
- Fail if any semicolon appears outside of code formatting.

## Good examples
- "Your program should respond with PONG when it receives PING."
- "The list contains four items."  
- "`PING; PONG`" (inside inline code → allowed)

## Bad examples
- "Your program should respond with PONG; when it receives PING." (semicolon in prose)
- "The list contains four items; each is unique." (semicolon in prose)

## How to fix
- Remove semicolons from normal text. Rephrase sentences if needed.