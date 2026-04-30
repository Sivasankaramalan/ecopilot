/**
 * Scope detector — identifies dangerously overbroad scope phrases and
 * proposes scoped alternatives.
 *
 * Overbroad prompts push the model into agent mode, read many files,
 * make many sub-calls, and consume 3–10× more premium requests than needed.
 */

export interface ScopeIssue {
  matched_text: string;
  severity: "warning" | "critical";
  reason: string;
  scoped_alternative: string;
}

export interface ScopeCheckResult {
  has_scope_issues: boolean;
  issues: ScopeIssue[];
  overall_severity: "none" | "warning" | "critical";
  recommendation: string;
}

// ── Scope issue catalogue ─────────────────────────────────────────────────────

interface ScopePattern {
  pattern: RegExp;
  severity: "warning" | "critical";
  reason: string;
  alternative: string;
}

const SCOPE_PATTERNS: ScopePattern[] = [
  {
    pattern: /\bentire codebase\b/i,
    severity: "critical",
    reason: "Scans every file — forces agent mode, costs 5–15 premium requests",
    alternative: "Specify the module, package, or directory (e.g. 'in src/auth/')",
  },
  {
    pattern: /\bwhole codebase\b/i,
    severity: "critical",
    reason: "Same as 'entire codebase'",
    alternative: "Scope to a specific directory or layer",
  },
  {
    pattern: /\ball files\b/i,
    severity: "critical",
    reason: "Iterates every file — very expensive in agent mode",
    alternative: "List the specific files or use a glob pattern in the prompt",
  },
  {
    pattern: /\bevery file\b/i,
    severity: "critical",
    reason: "Same as 'all files'",
    alternative: "Enumerate the files explicitly or scope to a folder",
  },
  {
    pattern: /\bwhole project\b/i,
    severity: "critical",
    reason: "Full-project scan — agent will read many files",
    alternative: "Scope to the relevant module or feature folder",
  },
  {
    pattern: /\bacross the project\b/i,
    severity: "warning",
    reason: "May trigger multi-file reads",
    alternative: "Specify which layer: 'in the API layer', 'in all controller files'",
  },
  {
    pattern: /\beverywhere\b/i,
    severity: "warning",
    reason: "Unbounded scope",
    alternative: "Specify the files or patterns: '*.service.ts'",
  },
  {
    pattern: /\bdo everything\b/i,
    severity: "critical",
    reason: "Completely unbounded — will spawn many agent sub-tasks",
    alternative: "Break into numbered steps; address one at a time",
  },
  {
    pattern: /\bfix everything\b/i,
    severity: "critical",
    reason: "Open-ended fix — agent will scan and attempt to fix all issues found",
    alternative: "Specify the bug, failing test, or error message",
  },
  {
    pattern: /\brefactor everything\b/i,
    severity: "critical",
    reason: "Triggers full-codebase agent workflow",
    alternative: "Name the specific class, module, or pattern to refactor",
  },
  {
    pattern: /\bupdate all\b/i,
    severity: "warning",
    reason: "Bulk update — may touch many files",
    alternative: "List the files or specify a search pattern",
  },
  {
    pattern: /\ball (?:the )?\w+ files?\b/i,
    severity: "warning",
    reason: "Bulk file operation",
    alternative: "List specific files or constrain to a directory",
  },
  {
    pattern: /\bany (?:and all|issues?|bugs?|problems?|errors?)\b/i,
    severity: "warning",
    reason: "Open-ended scan — model will look for all possible issues",
    alternative: "Scope to a specific concern: 'null-safety issues in UserService'",
  },
];

// ── Main function ─────────────────────────────────────────────────────────────

export function checkScope(prompt: string): ScopeCheckResult {
  const issues: ScopeIssue[] = [];

  for (const { pattern, severity, reason, alternative } of SCOPE_PATTERNS) {
    const match = prompt.match(pattern);
    if (match?.[0] !== undefined) {
      issues.push({
        matched_text: match[0],
        severity,
        reason,
        scoped_alternative: alternative,
      });
    }
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasWarning = issues.length > 0;

  const overallSeverity = hasCritical ? "critical" : hasWarning ? "warning" : "none";

  let recommendation = "Prompt scope looks fine.";
  if (hasCritical) {
    recommendation =
      "Scope is too broad — this prompt will likely spawn 5–15 agent sub-calls and consume 3–10 premium requests. Narrow the scope before sending.";
  } else if (hasWarning) {
    recommendation =
      "Scope could be tightened. Consider specifying exact files, directories, or patterns to reduce agent iterations.";
  }

  return {
    has_scope_issues: issues.length > 0,
    issues,
    overall_severity: overallSeverity,
    recommendation,
  };
}
