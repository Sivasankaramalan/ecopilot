/**
 * Prompt rewriter — pure heuristics, zero LLM calls.
 *
 * Rules applied in order:
 *  1. Strip filler openers ("Can you please", "I was wondering if you could", …)
 *  2. Convert first word to imperative form where possible
 *  3. Strip trailing filler ("Feel free to ask if you need anything.", …)
 *  4. Suggest "show diff only" when refactor language detected
 *  5. Collapse multiple blank lines / leading-trailing whitespace
 */

export interface RewriteResult {
  original: string;
  tightened: string;
  changes_made: string[];
  original_tokens_estimate: number;
  tightened_tokens_estimate: number;
  savings_pct: number;
}

// ── Filler opener patterns ────────────────────────────────────────────────────

const OPENER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^can you please\s*/i,              label: "Removed 'Can you please'" },
  { pattern: /^could you please\s*/i,            label: "Removed 'Could you please'" },
  { pattern: /^could you\s*/i,                   label: "Removed 'Could you'" },
  { pattern: /^can you\s*/i,                     label: "Removed 'Can you'" },
  { pattern: /^i was wondering if you could\s*/i, label: "Removed 'I was wondering if you could'" },
  { pattern: /^i was wondering\s*/i,             label: "Removed 'I was wondering'" },
  { pattern: /^i would like you to\s*/i,         label: "Removed 'I would like you to'" },
  { pattern: /^i would like to\s*/i,             label: "Removed 'I would like to'" },
  { pattern: /^i would love for you to\s*/i,     label: "Removed 'I would love for you to'" },
  { pattern: /^please help me\s*/i,              label: "Removed 'Please help me'" },
  { pattern: /^can you help me\s*/i,             label: "Removed 'Can you help me'" },
  { pattern: /^possibly\s+/i,                    label: "Removed leading 'Possibly'" },
  { pattern: /^please\s+/i,                      label: "Removed leading 'Please'" },
];

// ── Filler trailer patterns ───────────────────────────────────────────────────

const TRAILER_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /\s*feel free to (?:ask|let me know)[^.]*\.\s*$/i,
    label: "Removed trailing 'Feel free to ask…'",
  },
  {
    pattern: /\s*let me know if you (?:have|need)[^.]*\.\s*$/i,
    label: "Removed trailing 'Let me know if you…'",
  },
  {
    pattern: /\s*let me know if (?:that|this) (?:helps|works|is correct)[^.]*\.\s*$/i,
    label: "Removed trailing 'Let me know if that helps'",
  },
  {
    pattern: /\s*thank(?:s| you)[^.]*\.\s*$/i,
    label: "Removed trailing 'Thanks'",
  },
  {
    pattern: /[,.]?\s*please\.?\s*$/i,
    label: "Removed trailing 'please'",
  },
];

// ── Inline filler removal ─────────────────────────────────────────────────────

const INLINE_FILLERS: { pattern: RegExp; replacement: string; label: string }[] = [
  { pattern: /\bjust\s+/g,       replacement: "",   label: "Removed 'just'" },
  { pattern: /\bbasically\s+/g,  replacement: "",   label: "Removed 'basically'" },
  { pattern: /\bessentially\s+/g, replacement: "",  label: "Removed 'essentially'" },
  { pattern: /\bsimply\s+/g,     replacement: "",   label: "Removed 'simply'" },
  { pattern: /\bkindly\s+/g,      replacement: "",   label: "Removed 'kindly'" },
  { pattern: /\bpossibly\s+/g,    replacement: "",   label: "Removed 'possibly'" },
  { pattern: /\bif possible\b/g,  replacement: "",   label: "Removed 'if possible'" },
  { pattern: /\bfeel free to\b/g, replacement: "",  label: "Removed 'feel free to'" },
  { pattern: /,?\s*as much as possible\b/g, replacement: "", label: "Removed 'as much as possible'" },
];

// ── Refactor → diff suggestion ────────────────────────────────────────────────

const REFACTOR_PATTERNS = [
  /\brewrite\b/i, /\brefactor\b/i, /\bclean\s+up\b/i, /\boverhaul\b/i,
];

// ── Rough token estimator (sync) ─────────────────────────────────────────────

function roughTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

// ── Capitalise first letter after stripping ───────────────────────────────────

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Main rewrite function ─────────────────────────────────────────────────────

export function tightenPrompt(prompt: string): RewriteResult {
  let text = prompt;
  const changes: string[] = [];

  // 1. Strip filler openers
  for (const { pattern, label } of OPENER_PATTERNS) {
    const next = text.replace(pattern, "");
    if (next !== text) {
      text = next;
      changes.push(label);
      break; // only one opener to remove
    }
  }

  // 2. Strip trailing filler
  for (const { pattern, label } of TRAILER_PATTERNS) {
    const next = text.replace(pattern, "");
    if (next !== text) {
      text = next;
      changes.push(label);
    }
  }

  // 3. Remove inline fillers
  for (const { pattern, replacement, label } of INLINE_FILLERS) {
    const next = text.replace(pattern, replacement);
    if (next !== text) {
      text = next;
      changes.push(label);
    }
  }

  // 4. Capitalise first character (may have been lowered after stripping opener)
  text = capitalizeFirst(text.trim());

  // 5. Collapse multiple spaces / blank lines
  const beforeCollapse = text;
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text !== beforeCollapse) changes.push("Collapsed extra whitespace");

  // 6. Suggest diff hint if refactor language present
  const hasDiffHint = /show (?:only )?(?:the )?(?:diff|changes|deltas)/i.test(text);
  if (!hasDiffHint && REFACTOR_PATTERNS.some((r) => r.test(text))) {
    text += "\n\nShow only the changed lines — do not repeat unchanged code.";
    changes.push("Appended diff hint: 'show only changed lines' (reduces model output tokens)");
  }

  const origTokens = roughTokens(prompt);
  const tightTokens = roughTokens(text);

  return {
    original: prompt,
    tightened: text,
    changes_made: changes,
    original_tokens_estimate: origTokens,
    tightened_tokens_estimate: tightTokens,
    // Savings are on input tokens only. When a diff-hint is appended the
    // tightened prompt may be slightly longer than the original, but the
    // model output tokens decrease — so we floor input savings at 0.
    savings_pct: origTokens > 0
      ? Math.max(0, Math.round(((origTokens - tightTokens) / origTokens) * 100))
      : 0,
  };
}
