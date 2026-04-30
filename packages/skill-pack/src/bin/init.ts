#!/usr/bin/env node
/**
 * EcoPilot Init — idempotent workspace scaffolder.
 *
 * Usage:
 *   npx @ecopilot/init [--mode=balanced|strict] [--target=<path>]
 *
 * What it does:
 *   1. Writes / merges .github/copilot-instructions.md
 *   2. Writes .github/instructions/ecopilot-routing.instructions.md
 *   3. Writes .github/skills/ecopilot/SKILL.md
 *   4. Patches .vscode/mcp.json with the ecopilot server entry
 *
 * All writes are idempotent: existing files are backed up (.bak) before
 * any modification. Re-running the scaffolder is safe.
 */

import { parseArgs } from "node:util";
import { scaffold } from "../scaffolder.js";

const { values } = parseArgs({
  options: {
    mode:   { type: "string",  default: "balanced" },
    target: { type: "string",  default: process.cwd() },
    force:  { type: "boolean", default: false },
  },
  strict: false,
});

const mode = (values["mode"] as string) === "strict" ? "strict" : "balanced";
const target = values["target"] as string;
const force = Boolean(values["force"]);

scaffold({ mode, target, force })
  .then(() => {
    console.log("\n✅ EcoPilot skill-pack installed.");
    console.log("   Restart VS Code for MCP changes to take effect.\n");
  })
  .catch((err: unknown) => {
    console.error("EcoPilot init failed:", String(err));
    process.exit(1);
  });
