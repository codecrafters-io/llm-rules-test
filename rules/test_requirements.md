---
id: tests_requirements
severity: error
summary: "Tests must show specific commands and at least one exact expected output."
micro_prompt: >
  Judge ONLY this rule:
  Rule: TESTS_REQUIREMENTS
  - "### Tests" MUST exist exactly once.
  - It MUST include specific tester commands AND at least one explicit expected output.
  - Output must match the command.
  Return JSON: {"id":"tests_requirements","pass":boolean,"rationale":string,"suggested_fixes":any[]}
---

## Good example
Command:
```bash
$ redis-cli BLPOP list_key 0.1
# Expect: *-1 → encoded as *-1\r\n
```

## Bad examples
- Only prose: “It should time out.” (no command/output)

## How to fix
Add both the exact command and its expected output.