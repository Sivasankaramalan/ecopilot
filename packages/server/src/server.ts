/**
 * EcoPilotServer — registers all MCP tools and starts the stdio transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { EcoPilotConfig } from "./config.js";
import { Logger } from "./logger.js";
import { createUiDriver } from "./ui/index.js";
import { ExtensionBridgeDriver } from "./ui/extension-bridge-driver.js";

import { askUserSchema, askUserTool } from "./tools/ask-user.js";
import { chooseOneSchema, chooseOneTool } from "./tools/choose-one.js";
import { chooseManySchema, chooseManyTool } from "./tools/choose-many.js";
import { multilineInputSchema, multilineInputTool } from "./tools/multiline-input.js";
import { confirmSchema, confirmTool } from "./tools/confirm.js";
import { notifySchema, notifyTool } from "./tools/notify.js";
import {
  startSessionSchema,
  startSessionTool,
  askInSessionSchema,
  askInSessionTool,
  endSessionSchema,
  endSessionTool,
} from "./tools/session.js";
import { healthCheckTool } from "./tools/health-check.js";
import { analyzePromptSchema, analyzePromptTool } from "./tools/analyze-prompt.js";
import { tightenPromptSchema, tightenPromptTool } from "./tools/tighten-prompt.js";
import { scopeCheckSchema, scopeCheckTool } from "./tools/scope-check.js";
import { getSavingsReportTool } from "./tools/get-savings-report.js";
import { rememberSchema, rememberTool } from "./tools/remember.js";
import { recallSchema, recallTool } from "./tools/recall.js";
import { forgetSchema, forgetTool } from "./tools/forget.js";
import { suggestModelSchema, suggestModelTool } from "./tools/suggest-model.js";

export class EcoPilotServer {
  private readonly logger: Logger;
  private readonly mcp: McpServer;

  constructor(private readonly config: EcoPilotConfig) {
    this.logger = new Logger(config.logLevel);
    this.mcp = new McpServer({ name: "ecopilot", version: "0.1.0" });
  }

  async start(): Promise<void> {
    const { config, logger, mcp } = this;
    const ui = createUiDriver(config, logger);
    const bridgePort =
      ui instanceof ExtensionBridgeDriver ? ui.port : 0;

    const disabled = new Set(config.disabledTools);
    const t = config.timeoutSecs;

    // ── Tool registrations ─────────────────────────────────────────────────

    if (!disabled.has("ask_user")) {
      mcp.tool(
        "ask_user",
        "Ask the user a question and return their answer. Use this instead of sending a follow-up chat message — it does NOT consume an additional Copilot premium request.",
        askUserSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await askUserTool(input, ui, t)) }],
        }),
      );
    }

    if (!disabled.has("choose_one")) {
      mcp.tool(
        "choose_one",
        "Present the user with a list and let them pick one option. Does NOT consume a Copilot premium request.",
        chooseOneSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await chooseOneTool(input, ui, t)) }],
        }),
      );
    }

    if (!disabled.has("choose_many")) {
      mcp.tool(
        "choose_many",
        "Present the user with a list and let them pick multiple options. Does NOT consume a Copilot premium request.",
        chooseManySchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await chooseManyTool(input, ui, t)) }],
        }),
      );
    }

    if (!disabled.has("multiline_input")) {
      mcp.tool(
        "multiline_input",
        "Collect long-form text, code snippets, or detailed feedback from the user. Does NOT consume a Copilot premium request.",
        multilineInputSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await multilineInputTool(input, ui, t)) }],
        }),
      );
    }

    if (!disabled.has("confirm")) {
      mcp.tool(
        "confirm",
        "Ask the user to confirm (yes/no) before a significant or destructive action. Does NOT consume a Copilot premium request.",
        confirmSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await confirmTool(input, ui, t)) }],
        }),
      );
    }

    if (!disabled.has("notify")) {
      mcp.tool(
        "notify",
        "Send a non-blocking notification to the user (status update, progress, completion). No reply needed.",
        notifySchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(notifyTool(input, ui)) }],
        }),
      );
    }

    if (!disabled.has("start_session")) {
      mcp.tool(
        "start_session",
        "Start a persistent multi-turn session. Use ask_in_session to ask multiple questions within the same Copilot premium request.",
        startSessionSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(startSessionTool(input)) }],
        }),
      );
    }

    if (!disabled.has("ask_in_session")) {
      mcp.tool(
        "ask_in_session",
        "Ask a question inside an active session (started with start_session). All questions are handled within the SAME premium request.",
        askInSessionSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await askInSessionTool(input, ui, t)) }],
        }),
      );
    }

    if (!disabled.has("end_session")) {
      mcp.tool(
        "end_session",
        "Close an active session and get a summary of how many user turns were handled without consuming extra premium requests.",
        endSessionSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(endSessionTool(input)) }],
        }),
      );
    }

    if (!disabled.has("health_check")) {
      mcp.tool(
        "health_check",
        "Check EcoPilot server status, UI mode, and bridge port.",
        {},
        () => ({
          content: [{ type: "text", text: JSON.stringify(healthCheckTool(config.uiMode, bridgePort)) }],
        }),
      );
    }

    // ── Prompt-hygiene tools (Phase 4) ────────────────────────────────────

    if (!disabled.has("analyze_prompt")) {
      mcp.tool(
        "analyze_prompt",
        "Analyse a prompt before sending it to Copilot: get token count, verbosity score, vague-phrase list, recommended model tier (mini/standard/premium with cost multiplier), recommended mode (Ask/Agent), and optional scope check. Use this to avoid wasting premium requests on bloated prompts.",
        analyzePromptSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await analyzePromptTool(input)) }],
        }),
      );
    }

    if (!disabled.has("tighten_prompt")) {
      mcp.tool(
        "tighten_prompt",
        "Rewrite a verbose prompt into a lean, verb-first imperative. Strips filler openers ('Can you please…'), trailing pleasantries, inline hedge words, and appends a 'show diff only' hint on refactor prompts. Returns original, tightened version, list of changes made, and estimated token savings %.",
        tightenPromptSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(tightenPromptTool(input)) }],
        }),
      );
    }

    if (!disabled.has("scope_check")) {
      mcp.tool(
        "scope_check",
        "Detect overbroad scope patterns in a prompt ('entire codebase', 'all files', 'fix everything', …). Returns a severity rating, matched phrases with reasons, and scoped alternatives. Critical issues indicate the prompt will likely trigger 5–15 agent sub-calls.",
        scopeCheckSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(scopeCheckTool(input)) }],
        }),
      );
    }

    if (!disabled.has("get_savings_report")) {
      mcp.tool(
        "get_savings_report",
        "Return your personal EcoPilot savings report: total prompts analyzed/tightened, tokens saved, premium-equivalent weighted savings broken down by today / this week / all-time and by model tier. Data is stored locally at ~/.ecopilot/usage.jsonl.",
        {},
        () => ({
          content: [{ type: "text", text: JSON.stringify(getSavingsReportTool()) }],
        }),
      );
    }

    // ── Memory tools (Phase 6) ────────────────────────────────────────────

    if (!disabled.has("remember")) {
      mcp.tool(
        "remember",
        "Save a key-value fact to persistent memory. Scope: 'user' (all projects, forever), 'workspace' (this project, persists across restarts), 'session' (in-memory, cleared on restart). Use this to avoid asking the user the same question twice.",
        rememberSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(rememberTool(input)) }],
        }),
      );
    }

    if (!disabled.has("recall")) {
      mcp.tool(
        "recall",
        "Retrieve a previously saved memory by key. Omit the key to list all stored keys in the given scope. Use this before asking the user for information you may have already been told.",
        recallSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(recallTool(input)) }],
        }),
      );
    }

    if (!disabled.has("forget")) {
      mcp.tool(
        "forget",
        "Delete a key from memory. Use when a stored value is outdated or no longer relevant.",
        forgetSchema.shape,
        (input) => ({
          content: [{ type: "text", text: JSON.stringify(forgetTool(input)) }],
        }),
      );
    }

    // ── Model-multiplier guard (Phase 7) ──────────────────────────────────

    if (!disabled.has("suggest_model")) {
      mcp.tool(
        "suggest_model",
        "Analyse a prompt and recommend the most cost-efficient Copilot model tier (mini/standard/premium). Optionally pass 'current_model' to get a warning when a cheaper model would suffice — preventing unnecessary 3× premium quota burn.",
        suggestModelSchema.shape,
        async (input) => ({
          content: [{ type: "text", text: JSON.stringify(await suggestModelTool(input)) }],
        }),
      );
    }

    // ── Start stdio transport ──────────────────────────────────────────────
    const transport = new StdioServerTransport();
    await mcp.connect(transport);
    logger.info(`EcoPilot MCP server running (PID ${process.pid})`);
  }
}
