/**
 * suggest_model MCP tool — model-multiplier guard.
 *
 * Analyses a prompt and tells the agent which Copilot model tier to use,
 * how much it costs relative to mini (the baseline), and what the user
 * could save by downgrading if the task doesn't warrant premium.
 */

import { z } from "zod";
import { analyzePrompt } from "../hygiene/analyzer.js";
import { ok } from "./shared.js";

export const suggestModelSchema = z.object({
  prompt: z.string().min(1).describe("The prompt you are about to send"),
  current_model: z.enum(["mini", "standard", "premium"]).optional().describe(
    "The model the user currently has selected. If provided, a cost-delta warning is added when the task doesn't justify it.",
  ),
});

export type SuggestModelInput = z.infer<typeof suggestModelSchema>;

const MULTIPLIERS: Record<string, number> = { mini: 0.33, standard: 1, premium: 3 };

const MODEL_LABELS: Record<string, string> = {
  mini:     "GPT-4o mini  (0.33× premium quota)",
  standard: "GPT-4o       (1× premium quota)",
  premium:  "o3 / Claude  (3× premium quota)",
};

const RATIONALE: Record<string, string> = {
  mini:     "Task is short, unambiguous, and doesn't need deep reasoning.",
  standard: "Moderate complexity — needs solid code/reasoning but not multi-step planning.",
  premium:  "Task requires multi-step reasoning, architecture decisions, or multi-file coordination.",
};

export async function suggestModelTool(input: SuggestModelInput): Promise<unknown> {
  const analysis = await analyzePrompt(input.prompt);
  const suggested = analysis.model_suggestion;
  const suggestedMultiplier = analysis.model_multiplier;

  const result: Record<string, unknown> = {
    suggested_model: suggested,
    suggested_model_label: MODEL_LABELS[suggested],
    cost_multiplier: suggestedMultiplier,
    rationale: RATIONALE[suggested],
    verbosity_score: analysis.verbosity_score,
    token_count: analysis.token_count,
    mode_suggestion: analysis.mode_suggestion,
  };

  // If the user told us what they have selected, warn if it's overkill
  if (input.current_model && input.current_model !== suggested) {
    const currentMultiplier = MULTIPLIERS[input.current_model]!;
    const suggestedMultiplierValue = MULTIPLIERS[suggested]!;

    if (currentMultiplier > suggestedMultiplierValue) {
      // They're using a more expensive model than needed
      const overchargeRatio = Math.round((currentMultiplier / suggestedMultiplierValue) * 10) / 10;
      result["warning"] = `You have '${input.current_model}' selected but this task only needs '${suggested}'. You are spending ${overchargeRatio}× more quota than necessary.`;
      result["downgrade_saves_pct"] = Math.round((1 - suggestedMultiplierValue / currentMultiplier) * 100);
    } else {
      // They're using a cheaper model than recommended — flag risk, don't force
      result["notice"] = `You have '${input.current_model}' selected; this task may benefit from '${suggested}' for better results.`;
    }
  }

  // Surface any vague phrases that inflate the perceived complexity
  if (analysis.vague_phrases.length > 0) {
    result["vague_phrases_detected"] = analysis.vague_phrases.map((v) => v.phrase);
    result["tip"] = "Removing vague phrases may lower the recommended model tier — try tighten_prompt first.";
  }

  return ok(result);
}
