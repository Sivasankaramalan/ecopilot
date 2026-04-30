/**
 * Prompt analyzer — pure heuristics, zero LLM calls.
 *
 * Outputs:
 *  - token_count          Accurate BPE token count
 *  - verbosity_score      0–100  (0 = lean, 100 = extremely bloated)
 *  - vague_phrases        List of phrases that make the prompt imprecise
 *  - model_suggestion     "mini" | "standard" | "premium"
 *  - model_multiplier     0.33 | 1 | 3
 *  - mode_suggestion      "ask" | "agent"
 *  - warnings             Actionable strings the caller can surface to the user
 *  - tightened_preview    Quick one-pass tightening preview (no full rewrite)
 */

import { countTokens } from "./tokenizer.js";

// ── Type definitions ──────────────────────────────────────────────────────────

export type ModelTier = "mini" | "standard" | "premium";
export type PromptMode = "ask" | "agent";

export interface PromptAnalysis {
  token_count: number;
  verbosity_score: number;
  vague_phrases: VaguePhrase[];
  model_suggestion: ModelTier;
  model_multiplier: 0.33 | 1 | 3;
  mode_suggestion: PromptMode;
  warnings: string[];
  tips: string[];
}

export interface VaguePhrase {
  phrase: string;
  reason: string;
  suggestion: string;
}

// ── Vague-phrase catalogue ────────────────────────────────────────────────────

const VAGUE_PHRASES: VaguePhrase[] = [
  { phrase: "can you please",    reason: "filler opener",   suggestion: "Remove entirely — start with the verb" },
  { phrase: "could you please",  reason: "filler opener",   suggestion: "Remove entirely — start with the verb" },
  { phrase: "could you",         reason: "filler opener",   suggestion: "Remove — use imperative: 'Refactor…'" },
  { phrase: "i was wondering",   reason: "hedging language", suggestion: "State the request directly" },
  { phrase: "i would like you to", reason: "indirect phrasing", suggestion: "Remove — start with the action verb" },
  { phrase: "i would like",      reason: "indirect phrasing", suggestion: "Remove — start with the action verb" },
  { phrase: "please help me",    reason: "filler",          suggestion: "Remove — state the task directly" },
  { phrase: "can you help me",   reason: "filler",          suggestion: "Remove — state the task directly" },
  { phrase: "if possible",       reason: "weakening qualifier", suggestion: "Remove — be direct" },
  { phrase: "as much as possible", reason: "vague qualifier", suggestion: "Specify the exact requirement" },
  { phrase: "in detail",         reason: "unscoped qualifier", suggestion: "Specify which details you need" },
  { phrase: "in great detail",   reason: "unscoped qualifier", suggestion: "Specify which details you need" },
  { phrase: "explain everything", reason: "unbounded scope",  suggestion: "Specify what exactly needs explanation" },
  { phrase: "explain all",       reason: "unbounded scope",  suggestion: "Specify which parts to explain" },
  { phrase: "do everything",     reason: "unbounded scope",  suggestion: "List the specific actions" },
  { phrase: "make it better",    reason: "undefined criterion", suggestion: "Specify the metric: performance, readability, security…" },
  { phrase: "improve it",        reason: "undefined criterion", suggestion: "Specify the metric" },
  { phrase: "fix it",            reason: "ambiguous",        suggestion: "Describe the specific bug or failing test" },
  { phrase: "any issues",        reason: "open-ended scan",  suggestion: "Scope to a specific concern: 'security issues', 'null-safety issues'" },
  { phrase: "feel free to",      reason: "unnecessary permission", suggestion: "Remove — the AI will do what you ask" },
];

// ── Model-tier decision table ─────────────────────────────────────────────────

// Patterns that signal a TRIVIAL task → recommend mini (0.33×)
const TRIVIAL_SIGNALS = [
  /\brename\b/i, /\bfix typo\b/i, /\bformat\b/i, /\badd comment\b/i,
  /\bsimple question\b/i, /\bwhat is\b/i, /\bwhat does\b/i,
  /\bexplain this line\b/i, /\bexplain this function\b/i,
  /\bquick question\b/i, /\bsmall fix\b/i, /\bone.?liner\b/i,
];

// Patterns that signal a PREMIUM task → recommend premium (3×)
const PREMIUM_SIGNALS = [
  /\barchitect\b/i, /\bdesign\s+(a|the|an)\b/i, /\bfrom scratch\b/i,
  /\bcomprehensive\b/i, /\bcomplex refactor\b/i, /\bmulti.?file\b/i,
  /\bacross the codebase\b/i, /\bacross all files\b/i,
  /\bsystem design\b/i, /\bmicroservice\b/i, /\bmigrat\w+\b/i,
];

// ── Mode decision ─────────────────────────────────────────────────────────────

const AGENT_MODE_SIGNALS = [
  /\bmulti.?file\b/i, /\bacross\b/i, /\brefactor\b/i,
  /\bmigrat\w+\b/i, /\barchitect\b/i, /\bscaffold\b/i,
  /\bfrom scratch\b/i, /\bset up\b/i, /\binitializ\w+\b/i,
];

// ── Verbosity scoring ─────────────────────────────────────────────────────────

/** Words that inflate prompts without adding information */
const FILLER_WORDS = [
  "please", "kindly", "basically", "essentially", "just", "simply",
  "very", "really", "quite", "extremely", "absolutely", "actually",
  "obviously", "clearly", "certainly", "definitely",
];

function computeVerbosityScore(prompt: string, tokenCount: number, vagueCount: number): number {
  const lower = prompt.toLowerCase();
  const wordCount = prompt.split(/\s+/).length;

  // Filler word density
  const fillerCount = FILLER_WORDS.filter((w) => lower.split(/\b/).includes(w)).length;
  const fillerDensity = Math.min(fillerCount / Math.max(wordCount, 1), 1);

  // Vague phrase penalty
  const vaguePenalty = Math.min(vagueCount * 8, 40);

  // Token-to-word ratio penalty (high ratio can indicate code-heavy prompts — not bad)
  // We care about raw word count being disproportionately high for simple tasks
  const sizePenalty = tokenCount > 500 ? Math.min((tokenCount - 500) / 20, 30) : 0;

  return Math.min(Math.round(fillerDensity * 30 + vaguePenalty + sizePenalty), 100);
}

// ── Main analysis ─────────────────────────────────────────────────────────────

export async function analyzePrompt(prompt: string): Promise<PromptAnalysis> {
  const lower = prompt.toLowerCase();
  const tokenCount = await countTokens(prompt);

  // Detect vague phrases
  const vagueFound = VAGUE_PHRASES.filter((vp) => lower.includes(vp.phrase));

  // Determine model tier
  let modelSuggestion: ModelTier = "standard";
  let modelMultiplier: 0.33 | 1 | 3 = 1;

  if (PREMIUM_SIGNALS.some((r) => r.test(prompt))) {
    modelSuggestion = "premium";
    modelMultiplier = 3;
  } else if (TRIVIAL_SIGNALS.some((r) => r.test(prompt)) && tokenCount < 120) {
    modelSuggestion = "mini";
    modelMultiplier = 0.33;
  }

  // Determine mode
  const modeSuggestion: PromptMode = AGENT_MODE_SIGNALS.some((r) => r.test(prompt))
    ? "agent"
    : "ask";

  // Verbosity score
  const verbosityScore = computeVerbosityScore(prompt, tokenCount, vagueFound.length);

  // Build warnings
  const warnings: string[] = [];
  if (vagueFound.length > 0) {
    warnings.push(
      `${vagueFound.length} vague phrase(s) detected: ${vagueFound.map((v) => `"${v.phrase}"`).join(", ")}`,
    );
  }
  if (tokenCount > 800) {
    warnings.push(
      `Prompt is ${tokenCount} tokens — consider trimming irrelevant context (paste only the relevant function/file section, not the whole file).`,
    );
  }
  if (modeSuggestion === "agent" && tokenCount < 60) {
    warnings.push(
      "This looks like an agent-mode task but the prompt is very short — consider adding specific file paths or acceptance criteria.",
    );
  }

  // Build tips
  const tips: string[] = [];
  if (modelSuggestion === "premium" && modeSuggestion !== "agent") {
    tips.push(
      "This prompt scored 'premium' complexity — if the task is actually straightforward, switch to Ask mode with a lighter model to save 2× quota.",
    );
  }
  if (lower.includes("rewrite") || lower.includes("rewrite the")) {
    tips.push(
      "Instead of asking for a full rewrite, try: \"Show diff only — do not repeat unchanged code\" — fewer output tokens, same result.",
    );
  }
  if (tokenCount > 300 && (lower.includes("entire file") || lower.includes("whole file"))) {
    tips.push(
      "You pasted a full file. Paste only the relevant function/class to reduce input tokens.",
    );
  }

  return {
    token_count: tokenCount,
    verbosity_score: verbosityScore,
    vague_phrases: vagueFound,
    model_suggestion: modelSuggestion,
    model_multiplier: modelMultiplier,
    mode_suggestion: modeSuggestion,
    warnings,
    tips,
  };
}
