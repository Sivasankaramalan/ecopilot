/**
 * tighten_prompt MCP tool — wraps the heuristic rewriter.
 */

import { z } from "zod";
import { tightenPrompt } from "../hygiene/rewriter.js";
import { ok } from "./shared.js";
import { logUsage } from "../telemetry/store.js";

export const tightenPromptSchema = z.object({
  prompt: z.string().min(1).describe("The verbose prompt to tighten"),
});

export type TightenPromptInput = z.infer<typeof tightenPromptSchema>;

export function tightenPromptTool(input: TightenPromptInput): unknown {
  const result = tightenPrompt(input.prompt);

  const saved = result.original_tokens_estimate - result.tightened_tokens_estimate;
  logUsage({
    ts: new Date().toISOString(),
    tool: "tighten_prompt",
    tokens_in: result.original_tokens_estimate,
    tokens_out: result.tightened_tokens_estimate,
    tokens_saved: Math.max(0, saved),
    // tighten_prompt doesn't run the full analyzer — default to standard tier
    model_suggestion: "standard",
    model_multiplier: 1,
    weighted_savings: Math.max(0, saved),
  });

  return ok(result as unknown as Record<string, unknown>);
}
