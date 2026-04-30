# EcoPilot — Copilot Premium Request Optimizer

## What it does

EcoPilot reduces GitHub Copilot premium request consumption by **40–70%**
on agent-mode workflows. It works by keeping agent sessions alive: instead
of posting follow-up chat messages (each of which costs a premium request),
the AI calls EcoPilot MCP tools that surface dialogs to you outside the
Copilot chat.

## Available tools (call these instead of chat messages)

| Tool | Description | When to use |
|---|---|---|
| `ask_user` | Single-line text / number input | Missing info, user preference |
| `choose_one` | Single-select from a list | Framework choice, approach selection |
| `choose_many` | Multi-select from a list | Feature selection, file selection |
| `multiline_input` | Long-form / code input | Detailed requirements, code snippets |
| `confirm` | Yes/No before risky action | File deletion, destructive commands |
| `notify` | Fire-and-forget status message | Build started, tests passed |
| `start_session` | Begin a multi-turn exchange | Workflows with many clarifications |
| `ask_in_session` | Ask within an active session | Each follow-up inside a session |
| `end_session` | Close a session + get savings summary | When workflow is complete |
| `health_check` | Check server status | Debugging |

## Routing rules enforced by this skill-pack

**Balanced mode** (default): EcoPilot tools are required for:
- All yes/no confirmations
- All branching decisions (pick one / pick many)
- Single-line or multi-line info gathering
- Status notifications

**Strict mode**: every interaction, including follow-up context and
clarifications, routes through EcoPilot tools.

Toggle mode by re-running `npx @ecopilot/init --mode=strict`.

## Quick reference — decision flowchart

```
Need user input?
├── Yes/No decision → confirm
├── Pick from options → choose_one or choose_many
├── Free-form short answer → ask_user
├── Free-form long answer / code → multiline_input
├── Multiple questions in sequence → start_session → ask_in_session (×N) → end_session
└── Just inform user (no reply needed) → notify
```
