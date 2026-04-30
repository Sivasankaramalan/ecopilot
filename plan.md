# Plan: EcoPilot — GitHub Copilot Premium Request Optimizer

A complete OSS toolkit that combines a Human-in-the-Loop MCP server, prompt-hygiene tools, a companion VS Code extension, telemetry/savings dashboard, session memory, model-multiplier guard, and a drop-in skill-pack. Goal: cut Copilot premium request consumption 40–70% on agent-heavy workflows.

## Core insight
- Tool-call responses do NOT consume premium requests; only user messages typed into chat do.
- Therefore: keep the agent turn alive by routing every confirmation, clarification, choice, and follow-up through MCP tool calls instead of chat replies.
- Layer prompt-hygiene + model-multiplier awareness on top to compound savings.

## Architecture (monorepo, 3 packages)

```
ecopilot/
├── packages/
│   ├── server/            # @ecopilot/mcp-server (Node + TypeScript, npm)
│   ├── extension/         # ecopilot-vscode (VS Code Marketplace)
│   └── skill-pack/        # @ecopilot/skill-pack (instructions + skills, npx scaffolder)
├── plugins/python/        # optional FastMCP plugin host (later)
├── docs/                  # marketing site + usage docs
└── examples/
```

Communication: extension ⇄ server over local WebSocket (port chosen at startup, written to `~/.ecopilot/runtime.json`). Server is spawned by VS Code's MCP client (`mcp.json`); extension auto-discovers and connects so MCP tool calls render as native VS Code UI.

## Phases

### Phase 1 — Core HITL MCP server (foundation)
1. Scaffold `packages/server` (TypeScript, FastMCP/`@modelcontextprotocol/sdk`, pnpm workspace, ESM).
2. Implement transport: stdio MCP + local WebSocket bridge to extension; fallback to terminal/notification when extension absent.
3. Implement core tools (mirror & improve on HITL + interactive-mcp):
   - `ask_user` (text/integer/float, validation, default)
   - `choose_one` / `choose_many` (predefined options)
   - `multiline_input` (long-form, code, descriptions)
   - `confirm` (yes/no/cancel + "yes-and-stop-asking-this-session")
   - `notify` (non-blocking info; doesn't await reply)
   - `start_session` / `ask_in_session` / `end_session` (intensive multi-turn flow inside one premium request)
4. Timeouts (default 5min, configurable via `--timeout`), cancellation, structured JSON responses.
5. CLI flags: `--timeout`, `--disable-tools`, `--ui=auto|extension|terminal|notify`, `--log-level`.

### Phase 2 — Companion VS Code extension (UI)
*Parallel with Phase 1 once tool contracts stabilize.*
1. Scaffold `packages/extension` (TypeScript, vsce). Activation event: `onStartupFinished`.
2. WebSocket client; auto-reconnect; status bar item showing "EcoPilot: connected · 23 saved today".
3. UI handlers per tool:
   - `ask_user` → `vscode.window.showInputBox`
   - `choose_one` → `vscode.window.showQuickPick`
   - `choose_many` → `showQuickPick({canPickMany:true})`
   - `multiline_input` → custom Webview with Monaco editor (syntax highlighting)
   - `confirm` → `showInformationMessage` with action buttons
   - `notify` → `showInformationMessage` (no await)
4. Webview dashboard (`EcoPilot: Show Dashboard` command) — savings stats, model usage breakdown, hygiene tips.
5. Bundle the skill-pack scaffolder as a command: `EcoPilot: Initialize in Workspace`.

### Phase 3 — Skill-pack & copilot-instructions bundle
*Parallel with Phase 2.*
1. `packages/skill-pack` ships a `npx @ecopilot/init` scaffolder.
2. Generates in target workspace:
   - `.github/copilot-instructions.md` — strict rules to route ALL clarification/confirmation/follow-up through EcoPilot tools; never type into chat for those.
   - `.github/instructions/ecopilot-routing.instructions.md` (`applyTo: "**"`) — reinforces routing rules per file.
   - `.github/skills/ecopilot/SKILL.md` — progressive-disclosure skill describing when/how to call each tool, loaded on demand only.
   - `.vscode/mcp.json` patch — registers the EcoPilot MCP server.
3. Idempotent + non-destructive (merge, don't overwrite; backup with `.bak`).
4. Provide variants: `--strict` (require tool for every interaction) vs `--balanced` (only for confirmations & branching).

### Phase 4 — Prompt-hygiene rewriter tools
1. New MCP tools exposed by server (no extra LLM call — pure heuristics + optional local rules):
   - `analyze_prompt` — input: draft prompt; output: token estimate, verbosity score, vague-phrase detector, model-multiplier suggestion (Opus 3× vs GPT-5 1× vs mini 0.33×), recommended mode (Ask vs Agent).
   - `tighten_prompt` — heuristic rewriter: strip filler ("can you please", "I was wondering"), enforce verb-first imperatives, suggest "show diff only" when refactor detected.
   - `scope_check` — detects "entire codebase", "all files", "everything" patterns and warns + proposes scoped alternative.
2. Token estimator uses `tiktoken` (gpt-tokenizer for browser-friendly).
3. Extension surfaces these as code actions on `.copilot-prompt.md` files and as a chat input lens.

### Phase 5 — Telemetry & savings dashboard
1. Local-only SQLite (`~/.ecopilot/usage.db`); zero network egress; opt-in anonymized aggregate stats (off by default).
2. Each tool call logs: timestamp, tool, duration, response size, inferred saved-request count (1 saved per HITL call within an active agent session).
3. Dashboard webview: today/week/month savings, top tools, estimated $ saved (using GitHub plan multipliers), session histograms.
4. Export CSV for team sharing.

### Phase 6 — Session memory & context cache
1. `remember(key, value)` and `recall(key)` MCP tools — scoped to session, workspace, or user.
2. Storage in `.ecopilot/memory.json` (workspace) or `~/.ecopilot/memory.json` (user).
3. Auto-suggest recall: server can intercept `ask_user` calls and short-circuit if a matching recent answer exists ("you said X 3 minutes ago — reuse?").
4. TTL configurable; explicit `forget(key)` tool.

### Phase 7 — Model-multiplier guard
1. `suggest_model` MCP tool — given prompt + task type, recommend cheapest sufficient model.
2. Extension status bar indicator showing currently selected model + multiplier (Opus 3× shown red for trivial tasks).
3. Optional pre-flight: when an expensive model is selected and `analyze_prompt` returns "trivial", show a `confirm` dialog suggesting downgrade.

### Phase 8 — Distribution, docs, launch
1. Publish: `@ecopilot/mcp-server` (npm), `ecopilot` (VS Code Marketplace), `@ecopilot/init` (npm scaffolder).
2. Docs site (Astro/Starlight in `docs/`): quickstart, tool reference, savings calculator, comparison table vs HITL/interactive-mcp.
3. README with the canonical 60-second install: `npx @ecopilot/init` + extension install link.
4. Launch posts: dev.to, Hacker News, the GitHub community discussion #163104 thread, Reddit r/github/r/vscode.
5. MIT license.

## Relevant files (will be created)

- `packages/server/src/index.ts` — MCP server entry, transport selection
- `packages/server/src/tools/*.ts` — one file per tool
- `packages/server/src/bridge/ws.ts` — WebSocket bridge to extension
- `packages/server/src/hygiene/{tokenizer,rewriter,detector}.ts` — Phase 4 logic
- `packages/server/src/storage/{usage-db,memory-store}.ts` — Phases 5/6
- `packages/extension/src/extension.ts` — activation, status bar, command registration
- `packages/extension/src/ui/{quickpick,inputbox,webview-multiline,webview-dashboard}.ts`
- `packages/extension/src/client/ws-client.ts` — auto-reconnecting WS client
- `packages/skill-pack/templates/copilot-instructions.md`
- `packages/skill-pack/templates/skills/ecopilot/SKILL.md`
- `packages/skill-pack/templates/mcp.json.fragment`
- `packages/skill-pack/bin/init.ts` — scaffolder CLI
- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `.changeset/` for releases
- `.github/workflows/{ci,release}.yml` — test, build, semantic-release

## Verification

1. **Server unit tests** (Vitest) — each tool with mocked transport; timeout/cancel paths.
2. **Extension integration tests** (`@vscode/test-electron`) — spawn server, exercise each UI handler.
3. **End-to-end with Copilot** — manual scenario script: 5 known agent tasks (refactor, multi-file edit, scaffold, debug, doc-gen) executed twice (with/without EcoPilot); compare premium request counts via GitHub billing API or `gh copilot` usage view.
4. **Skill-pack scaffold test** — run `npx @ecopilot/init` against fixture workspace, assert files merged correctly, assert idempotency on second run.
5. **Cross-platform CI** — macOS, Windows, Linux matrix in GitHub Actions.
6. **Telemetry correctness** — fixture-driven test asserting saved-request math matches expected.
7. **Manual UX walkthrough** — install via Marketplace in clean VS Code profile, verify <60s setup.
8. **Comparison benchmark** doc — publish before/after numbers in README (matches changeblogger.org table format).

## Decisions (locked)

- **Name**: EcoPilot.
- **Stack**: Node + TypeScript primary; Python FastMCP plugin host deferred to post-v1.
- **UI**: VS Code extension primary; terminal/notification fallback so MCP server works standalone.
- **Distribution**: OSS (MIT) — npm + VS Code Marketplace. No paid tier in v1.
- **Telemetry**: Local-only in v1; opt-in anonymized aggregate in v1.2 (clear consent dialog).
- **Storage**: SQLite via `better-sqlite3` for usage; JSON for memory.
- **Branding**: Proceed as "EcoPilot" (OSS use is low trademark risk).
- **Skill-pack default**: Balanced (confirmations + branches only) with one-click toggle to Strict.
- **Folder layout**: `ECOPILOT/` at workspace root containing the pnpm monorepo (`packages/server`, `packages/extension`, `packages/skill-pack`).
- **Differentiation vs HITL/interactive-mcp**: native VS Code UI, prompt hygiene tools, savings dashboard, drop-in skill-pack.

## First milestone (v0.1.0)

**Phases 1 + 3**: working MCP server with terminal/notification fallback + `npx @ecopilot/init` skill-pack scaffolder. Minimum installable product — users can adopt EcoPilot without the extension and still save requests.

Scope for v0.1.0:
- Phase 1 tools: `ask_user`, `choose_one`, `choose_many`, `multiline_input`, `confirm`, `notify`, `start_session/ask_in_session/end_session`.
- Phase 3 scaffolder: copilot-instructions.md (Balanced), `.instructions.md`, `SKILL.md`, mcp.json patch.
- CI for macOS/Linux/Windows; npm publish for both packages; README with quickstart.

Phases 2, 4, 5, 6, 7 follow in subsequent releases (v0.2 extension, v0.3 hygiene, v0.4 telemetry, etc.).
