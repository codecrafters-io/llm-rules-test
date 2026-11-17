---
id: hook_states_action
severity: error
summary: "Hook must state what the user will do (action-oriented)."
---

## Rule
- The hook must clearly state what the user will do (action-oriented).
- One or two sentences of context may come before the action sentence, as `hook_one_sentence` allows. The hook passes as long as it has the action sentence.

## Good examples

* “In this stage, you’ll implement support for the PING command.”
* “Every shell starts with a prompt (usually `$`) that signals it’s ready for your command. In this stage, you’ll print that prompt.”

## Bad examples

* “The PING command is used to test the connection.” as the whole hook (descriptive, with no action sentence)
* "This stage covers the PING command." (descriptive, not action-oriented)

## How to fix

* Add or rewrite a sentence so the hook says what the user will do: “In this stage, you’ll …”.
