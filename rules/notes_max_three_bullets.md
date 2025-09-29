---
id: notes_max_three_bullets
severity: warn
summary: "If \"### Notes\" exists, it must contain ≤ 3 bullet points (bullets may be multi-sentence)."
---

## Rule
- If there is no "### Notes" section, PASS (not applicable).
- If "### Notes" exists, it should have 3 bullet points at most - remember that each bullet point can be multiple sentences and have sub-bullets.

## Good examples
```md
### Notes
- Null array is *-1\r\n (RESP2).
- Fractional timeouts (e.g., 0.1) may be used by the tester.
- Don’t confuse null vs empty arrays.
```

## Bad examples
```md
### Notes
- Point 1
- Point 2
- Point 3
- Point 4
```

## How to fix
- Reduce bullets to three or fewer by consolidating or removing low-value items.