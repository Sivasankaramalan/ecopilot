import { describe, it, expect } from "vitest";
import { analyzePrompt } from "../src/hygiene/analyzer.js";
import { tightenPrompt } from "../src/hygiene/rewriter.js";
import { checkScope } from "../src/hygiene/scope-detector.js";

// ── analyzer ─────────────────────────────────────────────────────────────────

describe("analyzePrompt", () => {
  it("detects vague filler opener", async () => {
    const result = await analyzePrompt("Can you please refactor the auth module");
    expect(result.vague_phrases.length).toBeGreaterThan(0);
    expect(result.vague_phrases.some((v) => v.phrase === "can you please")).toBe(true);
  });

  it("returns non-zero token count", async () => {
    const result = await analyzePrompt("Rename the UserService class to AccountService");
    expect(result.token_count).toBeGreaterThan(0);
  });

  it("suggests mini for trivial tasks", async () => {
    const result = await analyzePrompt("Rename the variable x to userId");
    expect(result.model_suggestion).toBe("mini");
    expect(result.model_multiplier).toBe(0.33);
  });

  it("suggests premium for complex tasks", async () => {
    const result = await analyzePrompt(
      "Architect a comprehensive multi-file microservice migration from scratch",
    );
    expect(result.model_suggestion).toBe("premium");
    expect(result.model_multiplier).toBe(3);
  });

  it("suggests agent mode for multi-file tasks", async () => {
    const result = await analyzePrompt("Refactor all the components across the project");
    expect(result.mode_suggestion).toBe("agent");
  });

  it("suggests ask mode for single-file tasks", async () => {
    const result = await analyzePrompt("Add a null check to this function");
    expect(result.mode_suggestion).toBe("ask");
  });

  it("produces rewrite tip for refactor prompts", async () => {
    const result = await analyzePrompt("Rewrite the entire UserController class");
    expect(result.tips.some((t) => t.includes("diff"))).toBe(true);
  });

  it("warns about oversized prompts", async () => {
    const bigPrompt = "Explain this: " + "a b c d e f g h i j k l m n o p q r s t u v w x y z ".repeat(60);
    const result = await analyzePrompt(bigPrompt);
    expect(result.warnings.some((w) => w.includes("tokens"))).toBe(true);
  });
});

// ── rewriter ──────────────────────────────────────────────────────────────────

describe("tightenPrompt", () => {
  it("removes 'Can you please' opener", () => {
    const r = tightenPrompt("Can you please refactor the auth module");
    expect(r.tightened).not.toMatch(/^can you please/i);
    expect(r.changes_made.length).toBeGreaterThan(0);
  });

  it("removes 'I was wondering if you could'", () => {
    const r = tightenPrompt("I was wondering if you could add error handling here");
    expect(r.tightened).not.toMatch(/^I was wondering/i);
  });

  it("appends diff hint for refactor prompts", () => {
    const r = tightenPrompt("Refactor the payment service");
    expect(r.tightened).toContain("Show only the changed lines");
    expect(r.changes_made.some((c) => c.includes("diff"))).toBe(true);
  });

  it("does not duplicate diff hint", () => {
    const r = tightenPrompt("Refactor the payment service. Show only the diff.");
    const count = (r.tightened.match(/Show only/gi) ?? []).length;
    expect(count).toBe(1);
  });

  it("computes savings_pct >= 0", () => {
    const r = tightenPrompt("Can you please just simply kindly refactor this class");
    expect(r.savings_pct).toBeGreaterThanOrEqual(0);
  });

  it("removes inline 'just' filler", () => {
    const r = tightenPrompt("Just add a null check to this function");
    expect(r.tightened).not.toContain("just ");
  });

  it("preserves technical content", () => {
    const prompt = "Rename UserService to AccountService";
    const r = tightenPrompt(prompt);
    expect(r.tightened).toContain("UserService");
    expect(r.tightened).toContain("AccountService");
  });
});

// ── scope detector ────────────────────────────────────────────────────────────

describe("checkScope", () => {
  it("flags 'entire codebase' as critical", () => {
    const r = checkScope("Refactor the entire codebase to use async/await");
    expect(r.has_scope_issues).toBe(true);
    expect(r.overall_severity).toBe("critical");
    expect(r.issues[0]?.severity).toBe("critical");
  });

  it("flags 'all files' as critical", () => {
    const r = checkScope("Update all files to use the new import syntax");
    expect(r.overall_severity).toBe("critical");
  });

  it("flags 'everywhere' as warning", () => {
    const r = checkScope("Add logging everywhere in the service");
    expect(r.has_scope_issues).toBe(true);
    expect(r.overall_severity).toBe("warning");
  });

  it("returns none for scoped prompt", () => {
    const r = checkScope("Add null check to UserService.createUser()");
    expect(r.has_scope_issues).toBe(false);
    expect(r.overall_severity).toBe("none");
  });

  it("provides scoped_alternative for each issue", () => {
    const r = checkScope("Fix everything in the project");
    expect(r.issues.every((i) => i.scoped_alternative.length > 0)).toBe(true);
  });

  it("provides recommendation string", () => {
    const r = checkScope("Refactor the entire codebase");
    expect(r.recommendation.length).toBeGreaterThan(10);
  });
});
