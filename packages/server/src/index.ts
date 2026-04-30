#!/usr/bin/env node
/**
 * EcoPilot MCP Server — entry point.
 *
 * Starts an MCP server over stdio and optionally bridges to the EcoPilot
 * VS Code extension over a local WebSocket so that tool calls render as
 * native VS Code UI (QuickPick, InputBox, Webview). Falls back to
 * terminal/OS-notification prompts when the extension is absent.
 */

import { parseArgs } from "node:util";
import { EcoPilotServer } from "./server.js";
import { resolveConfig } from "./config.js";

const { values } = parseArgs({
  options: {
    timeout: { type: "string", short: "t" },
    "ui-mode": { type: "string" },
    "disable-tools": { type: "string", short: "d" },
    "log-level": { type: "string" },
    port: { type: "string" },
  },
  strict: false,
});

const config = resolveConfig({
  ...(values["timeout"] !== undefined && { timeoutSecs: Number(values["timeout"]) }),
  ...(values["ui-mode"] !== undefined && { uiMode: values["ui-mode"] as string }),
  disabledTools: values["disable-tools"]
    ? String(values["disable-tools"]).split(",").map((s) => s.trim())
    : [],
  ...(values["log-level"] !== undefined && { logLevel: values["log-level"] as string }),
  ...(values["port"] !== undefined && { extensionPort: Number(values["port"]) }),
});

const server = new EcoPilotServer(config);
server.start().catch((err: unknown) => {
  process.stderr.write(`EcoPilot server fatal error: ${String(err)}\n`);
  process.exit(1);
});
