---
id: hook_states_action
severity: error
summary: "Hook must clearly state what the learner will implement or change in this stage."
micro_prompt: >
  Judge ONLY this rule:
  Rule: HOOK_STATES_ACTION
  - The hook must clearly state the learner’s concrete action/outcome (what they will implement or change).
  - Vague teasers without an action FAIL.
  Return JSON: {"id":"hook_states_action","pass":boolean,"rationale":string,"suggested_fixes":string[]}
---

## Rule
State a clear, concrete action the learner will perform in this stage.

## Good examples
- “You’ll implement `BLPOP` with a non-zero timeout that returns `*-1\r\n` on expiry.”

## Bad examples
- “Redis lists can block.” (descriptive, not actionable)

## How to fix
- Rewrite to name the exact command/behavior the learner will implement.
