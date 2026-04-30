/**
 * Telemetry store — appends usage entries as newline-delimited JSON
 * to ~/.ecopilot/usage.jsonl (or $ECOPILOT_DATA_DIR/usage.jsonl).
 *
 * Fire-and-forget: errors are swallowed so telemetry never surfaces
 * through a tool response.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type ModelTier = "mini" | "standard" | "premium";

export interface UsageEntry {
  /** ISO-8601 timestamp */
  ts: string;
  tool: "analyze_prompt" | "tighten_prompt";
  /** Token count of the original prompt */
  tokens_in: number;
  /** Token count after rewriting (same as tokens_in for analyze_prompt) */
  tokens_out: number;
  /** tokens_in − tokens_out (0 for analyze_prompt) */
  tokens_saved: number;
  /** Recommended model tier for this prompt */
  model_suggestion: ModelTier;
  /** Cost multiplier for model_suggestion: 0.33 | 1 | 3 */
  model_multiplier: number;
  /** tokens_saved × model_multiplier  — premium-equivalent tokens saved */
  weighted_savings: number;
}

export function getDataDir(): string {
  return process.env["ECOPILOT_DATA_DIR"] ?? join(homedir(), ".ecopilot");
}

export function getUsageFilePath(): string {
  return join(getDataDir(), "usage.jsonl");
}

export function logUsage(entry: UsageEntry): void {
  try {
    const dir = getDataDir();
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "usage.jsonl"), JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // telemetry is best-effort — never propagate errors
  }
}
