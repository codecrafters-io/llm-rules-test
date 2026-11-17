---
id: hints_section_shape
severity: warn
summary: "A stage description has no '### Hints' section. Hints live in each language's config.yml."
---

## Rule
- Hints live outside the stage description, in `solutions/<language>/<stage>/code/config.yml`.
- A stage description has no `### Hints` section and no heading that starts with "Hint".
- Pass when the description has no such heading.

## Good examples
- A description whose headings are explanation sections, `### Tests`, and `### Notes`.

## Bad examples
```md
### Hints

<details>
<summary>How do I send the request?</summary>
...
</details>
```

## How to fix
- Move each hint into the language's `config.yml`, with the question as its title.
- If the learner can't pass without it, it is not a hint: put it in an explanation section.
