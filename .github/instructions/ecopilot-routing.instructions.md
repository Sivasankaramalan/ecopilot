---
applyTo: "**"
---
# EcoPilot Routing Rules (Balanced Mode)
#
# These rules reduce GitHub Copilot premium request consumption by
# routing all user confirmations, choices, and clarifications through
# EcoPilot MCP tools instead of posting new chat messages.
#
# HOW IT SAVES REQUESTS:
#   - MCP tool responses are NOT counted as premium requests.
#   - Only messages you type into the Copilot chat are counted.
#   - By keeping the agent turn alive via EcoPilot tools, one task that
#     normally costs 4–6 requests now costs 1.

## When to use EcoPilot tools

Use the EcoPilot MCP tools in these situations — do NOT post a follow-up
chat message for any of them:

1. **Confirmations before risky actions** (file deletion, git reset, overwrite)
   → use `confirm`

2. **Branching decisions** (which approach, which framework, which file to modify)
   → use `choose_one` or `choose_many`

3. **Missing information that can be answered in one line**
   → use `ask_user`

4. **Missing information that requires detail, code, or multi-line text**
   → use `multiline_input`

5. **Progress / status updates** (build started, tests passing)
   → use `notify`

6. **Multi-step workflows where you will ask more than one question**
   → use `start_session` → `ask_in_session` (repeat) → `end_session`

## When NOT to use EcoPilot tools

- Your original task prompt (that is still a chat message)
- Explanatory output the user did not ask for
- Errors or exceptions that require model reasoning to resolve

## After every response

Always check: "Is there anything unclear or undecided that would cause me
to post another chat message?" If yes, use an EcoPilot tool instead.
