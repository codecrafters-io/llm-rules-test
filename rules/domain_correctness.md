---
id: domain_correctness
severity: error
summary: "Content must be factually and technically correct."
---

## Rule
- Evaluate **only objective, domain facts that do not change and does not depend on official documentation** (e.g., array is ordered, len(4 items) = 4).  
- **Do not** judge facts that can change over time or depend on official documentation (e.g., "vectorset is a Redis type", "you can now pass fractional timeouts to this function", "this command is deprecated").
- **Do not** be nitpicky about minor wording differences** that do not change the meaning (e.g., "A list is a collection of ordered elements." vs "A list is an ordered collection of elements.").

## Good examples
- "A list is a collection of ordered elements."
- "'vectorset is a Redis type.' - PASS (not judging Redis docs)"
- "You can now pass fractional timeouts to this function. - PASS (should be pass since you can't confirm or deny this)"

## Bad examples
- "A list is an unordered collection of elements." (lists are ordered)
- "'vectorset is a Redis type.' - FAIL (judging Redis docs, which can change)"
- "You can now pass fractional timeouts to this function. - FAIL (should not judge this)"