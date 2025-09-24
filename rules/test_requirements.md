---
id: tests_requirements
severity: error
summary: "Tests must show specific commands and at least one exact expected output."
---

## Rule
"### Tests" MUST include specific tester commands AND at least one explicit expected output.

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