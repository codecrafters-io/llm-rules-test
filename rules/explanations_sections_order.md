---
id: explanations_sections_order
severity: error
summary: "Order of sections should be -> Hook -> Titled explanation section(s) -> '### Tests' section -> optional '### Notes' section."
--- 

## Rule
- Order should be:
  1. Hook
  2. One or more titled explanation section(s) (e.g., `### Understanding BLPOP Timeouts`)
  3. `### Tests`
  4. Optional `### Notes`
- Nothing else follows `### Tests`, and `### Notes` never comes before it.
- A stage description has no `### Hints` section. Hints live in each language's `config.yml`.

## Good examples
```md
In this stage, you’ll implement support for the BLPOP command.
### Understanding BLPOP Timeouts
...
### Tests
...
### Notes
...
```

## Bad examples
```md
In this stage, you’ll implement support for the BLPOP command.
### Tests
...
### Understanding BLPOP Timeouts
...
### Notes
...
```

```md
In this stage, you’ll implement support for the BLPOP command.
### Understanding BLPOP Timeouts
...
### Hints
...
### Tests
...
```

## How to fix
- Rearrange sections to follow the correct order: Hook, Explanation(s), Tests, Notes (if present).
- Move hints out of the description and into the language's `config.yml`.