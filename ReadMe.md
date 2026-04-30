# ⚡ EcoPilot

> Stop burning Copilot premium requests. Human-in-the-loop MCP tools + prompt hygiene for VS Code.

[![npm](https://img.shields.io/npm/v/@ecopilot/mcp-server?label=%40ecopilot%2Fmcp-server&color=22c55e)](https://www.npmjs.com/package/@ecopilot/mcp-server)
[![npm](https://img.shields.io/npm/v/@ecopilot/skill-pack?label=%40ecopilot%2Fskill-pack&color=22c55e)](https://www.npmjs.com/package/@ecopilot/skill-pack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The problem

Every time your AI agent asks a follow-up question, or sends a verbose prompt to `o3`, that's a **premium request** — consuming quota fast.

| Without EcoPilot | With EcoPilot |
|---|---|
| Agent asks follow-up → 1 premium request | `ask_user` tool → **0 premium requests** |
| Verbose "can you please just..." prompt | `tighten_prompt` → up to **60% fewer tokens** |
| `o3` selected for a trivial rename | `suggest_model` → use **mini (0.33×)** |
| Agent loops on missing info | `session` tools → **1 request, many questions** |

---

## Install in 60 seconds

### 1. Add the MCP server

In VS Code, open `~/.vscode/mcp.json` (or `Cmd+Shift+P` → _MCP: Open User Configuration_) and add:

```json
{
  "servers": {
    "ecopilot": {
      "command": "npx",
      "args": ["-y", "@ecopilot/mcp-server@latest"]
    }
  }
}
```

### 2. Scaffold your workspace

```bash
npx @ecopilot/skill-pack
```

This writes `.github/copilot-instructions.md` and routing instructions so Copilot knows when to call EcoPilot tools automatically.

### 3. Start chatting

```
@workspace analyze_prompt "Can you please just simply refactor the entire UserController?"
```

---

## Tools

### Human-in-the-Loop (0 premium requests)

| Tool | What it does |
|---|---|
| `ask_user` | Text input dialog |
| `choose_one` | Single-select list |
| `choose_many` | Multi-select list |
| `multiline_input` | Monaco editor panel (with VS Code extension) |
| `confirm` | Yes/No confirmation before destructive actions |
| `notify` | Fire-and-forget notification |
| `start_session` / `ask_in_session` / `end_session` | Many questions, 1 request |

### Prompt Hygiene

| Tool | What it does |
|---|---|
| `analyze_prompt` | Token count, verbosity score, vague phrases, model recommendation |
| `tighten_prompt` | Rewrites to lean verb-first imperative, shows token savings % |
| `scope_check` | Detects overbroad scope patterns before they cause agent loops |

### Memory

| Tool | What it does |
|---|---|
| `remember` | Store a key-value fact (`user` / `workspace` / `session` scope) |
| `recall` | Retrieve a value — no need to ask the user again |
| `forget` | Delete a stored key |

### Model Guard

| Tool | What it does |
|---|---|
| `suggest_model` | Recommends cheapest sufficient tier; warns when premium is overkill |

### Savings Tracking

| Tool | What it does |
|---|---|
| `get_savings_report` | Aggregated token savings (today / week / all-time) from `~/.ecopilot/usage.jsonl` |

---

## VS Code Extension

Install the companion extension for:

- **Native dialogs** — `ask_user` opens a VS Code `InputBox`, not a terminal prompt
- **Monaco multiline panel** — `multiline_input` opens a full editor panel (Ctrl+Enter to submit)
- **Status bar** — live token savings counter in the bottom bar
- **Savings Dashboard** — 30-day bar chart + model tier breakdown (`EcoPilot: Show Savings Dashboard`)

> Extension publish coming soon. Source in `packages/extension/`.

---

## Documentation

Full tool reference, interactive savings calculator, and architecture guide:
👉 **[ecopilot.dev](https://ecopilot.dev)** _(deploying soon)_

---

## Monorepo structure

```
packages/
  server/       @ecopilot/mcp-server   — MCP server (17 tools)
  extension/    ecopilot-vscode        — VS Code companion extension
  skill-pack/   @ecopilot/skill-pack   — npx workspace scaffolder
docs/                                  — Astro Starlight docs site
```

---

## Contributing

```bash
git clone https://github.com/Sivasankaramalan/ecopilot.git
cd ecopilot
pnpm install
pnpm build
pnpm test
```

PRs welcome. Please open an issue first for large changes.

---

## License

[MIT](LICENSE) © 2026 Sivasankaramalan Gunasekara Sivam