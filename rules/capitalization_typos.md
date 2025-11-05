---
id: capitalization_typos
severity: error
summary: "Prose must not contain stray internal capitalization (e.g., 'THe', 'tHe', 'clienT')."
---

## Rule
- Prose must not contain stray internal capitalization (e.g., 'THe', 'tHe', 'clienT').
- Scan **prose only** (paragraphs & list items). **Ignore** fenced code blocks, inline code (`` `like this` ``), and headings.
- **Allow**: ALL-CAPS acronyms/initialisms (e.g., `HTTP`, `JSON`, `RESP`, `CLI`, `TTL`, `MD`), Uppercase+digits/symbols tokens (e.g., `JSON5`, `HTTP/2`), Proper/brand mixed-case tokens (e.g., `OpenAI`, `YouTube`, `iOS`, `eBay`)

## Good examples
- `The literal string is encoded as a RESP bulk string.`
- `Clients send commands using RESP.`

## Bad examples
- `THe literal string is encoded as a RESP bulk string.`
- `The cLIent sends a command.`
- `tHe server responds with PONG.`
- `The clienT sends data.`
