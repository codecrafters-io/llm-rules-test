---
id: explanation_sections_after_hook
severity: error
summary: "After the hook, there must be one or more titled explanation section(s), each focused on a single topic."
---

## Rule
- After the hook, content must be organized into titled explanation section(s) (>= 1).

## Good examples
- `### Understanding BLPOP Timeouts`  
  Explains what the timeout means and when a null array is returned.
- `### Unblocking Behavior`  
  Explains the array response when an item is pushed before timeout.

## Bad examples
- No explanation sections; goes straight to `### Tests`.
- `### Timeouts and Blocking and RESP and Edge Cases` (mixed topics in one section).

## How to fix
- Add at least one `### <Title>` explanation section before `### Tests`.


