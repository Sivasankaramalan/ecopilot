/**
 * analyze_prompt MCP tool — wraps the hygiene analyzer.
 */

import { z } from "zod";
import { analyzePrompt } from "../hygiene/analyzer.js";
import { ok } from "./shared.js";
import { logUsage } from "../telemetry/store.js";

export const analyzePromptSchema = z.object({
  prompt: z.string().min(1).describe("The draft prompt you are about to send to Copilot"),
  include_scope_check: z.boolean().default(true).describe("Also run the scope-issue detector"),
});

export type AnalyzePromptInput = z.infer<typeof analyzePromptSchema>;

export async function analyzePromptTool(input: AnalyzePromptInput): Promise<unknown> {
  const analysis = await analyzePrompt(input.prompt);

  logUsage({
    ts: new Date().toISOString(),
    tool: "analyze_prompt",
    tokens_in: analysis.token_count,
    tokens_out: analysis.token_count,
    tokens_saved: 0,
    model_suggestion: analysis.model_suggestion,
    model_multiplier: analysis.model_multiplier,
    weighted_savings: 0,
  });

  let scopeResult: unknown = undefined;
  if (input.include_scope_check) {
    const { checkScope } = await import("../hygiene/scope-detector.js");
    scopeResult = checkScope(input.prompt);
  }

  return ok({
    ...analysis,
    ...(scopeResult !== undefined ? { scope: scopeResult } : {}),
  });
}
