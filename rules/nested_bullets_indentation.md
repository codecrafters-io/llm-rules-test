---
id: nested_bullets_indentation
severity: error
summary: "Deeply nested bullet points must use four spaces of indentation per level."
---

## Rule

- For bullet lists with two or more levels of nesting, each level must be indented by **four additional spaces** relative to its parent.
- This rule does not apply to lists with only one level of nesting.

## Good examples

```md
The structure consists of the following fields:

- `type`: The type of tool (always "function" for tools)
- `function`: Contains the function definition
    - `name`: The name of the function (e.g., "Read")
    - `description`: Explains the function's purpose...
    - `parameters`: A JSON schema describing the function's parameters
        - `properties`: Defines each parameter...
        - `required`: Lists which parameters are mandatory
```

```md
- Level 1:
  - Level 2
- Level 1:
  - Level 2
  - Level 2
```

## Bad examples

```md
The structure consists of the following fields:

- `type`: The type of tool (always "function" for tools)
- `function`: Contains the function definition
  - `name`: The name of the function (e.g., "Read")
  - `description`: Explains the function's purpose...
  - `parameters`: A JSON schema describing the function's parameters
    - `properties`: Defines each parameter...
    - `required`: Lists which parameters are mandatory
```


## How to fix

- Increase indentation so that each nested level is exactly four spaces deeper than its parent, when two or more levels of nesting are present.