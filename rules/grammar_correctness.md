---
id: grammar_correctness
severity: error
summary: "Text must use clear, standard grammar."
---

## Rule
- Sentences must use correct spelling, grammar, and basic punctuation.  
- Please pass even if there are minor issues, but fail for major issues that impede understanding.
- Do not check - 1) code blocks or inline code. 2) article "an" vs "a" for acronyms (e.g., "an LLM", "a RESP array").
- If you fail, your solution should not include semicolons, find another way.

## Good examples
- "Today I say we go up."
- "Your program should return PONG when it receives PING."
- "Lists are an ordered collection of elements."

## Bad examples
- "tday I say we go up." (misspelled word: should be "today")
- "Your program return PONG when it receive PING." (subject-verb disagreement)
- "A lists is ordered collection." (plural/singular mismatch)