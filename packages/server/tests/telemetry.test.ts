import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Point telemetry at a temp dir for the duration of each test
let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ecopilot-test-"));
  process.env["ECOPILOT_DATA_DIR"] = tmpDir;
});
afterEach(() => {
  delete process.env["ECOPILOT_DATA_DIR"];
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("telemetry store", () => {
  it("appends a JSONL entry to usage.jsonl", async () => {
    const { logUsage } = await import("../src/telemetry/store.js");
    logUsage({
      ts: "2026-04-29T10:00:00.000Z",
      tool: "analyze_prompt",
      tokens_in: 80,
      tokens_out: 80,
      tokens_saved: 0,
      model_suggestion: "premium",
      model_multiplier: 3,
      weighted_savings: 0,
    });

    const raw = readFileSync(join(tmpDir, "usage.jsonl"), "utf8");
    const parsed = JSON.parse(raw.trim());
    expect(parsed.tool).toBe("analyze_prompt");
    expect(parsed.tokens_in).toBe(80);
    expect(parsed.model_suggestion).toBe("premium");
  });

  it("appends multiple entries on successive calls", async () => {
    const { logUsage } = await import("../src/telemetry/store.js");
    logUsage({ ts: new Date().toISOString(), tool: "tighten_prompt", tokens_in: 50, tokens_out: 30, tokens_saved: 20, model_suggestion: "standard", model_multiplier: 1, weighted_savings: 20 });
    logUsage({ ts: new Date().toISOString(), tool: "tighten_prompt", tokens_in: 40, tokens_out: 25, tokens_saved: 15, model_suggestion: "mini", model_multiplier: 0.33, weighted_savings: 4.95 });

    const lines = readFileSync(join(tmpDir, "usage.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});

describe("telemetry reporter", () => {
  it("returns zero stats when log is empty", async () => {
    const { generateReport } = await import("../src/telemetry/reporter.js");
    const report = generateReport();
    expect(report.all_time.tokens_saved).toBe(0);
    expect(report.all_time.prompts_analyzed).toBe(0);
    expect(report.all_time.prompts_tightened).toBe(0);
  });

  it("aggregates all_time stats correctly", async () => {
    const { logUsage } = await import("../src/telemetry/store.js");
    const { generateReport } = await import("../src/telemetry/reporter.js");

    logUsage({ ts: new Date().toISOString(), tool: "analyze_prompt", tokens_in: 100, tokens_out: 100, tokens_saved: 0, model_suggestion: "premium", model_multiplier: 3, weighted_savings: 0 });
    logUsage({ ts: new Date().toISOString(), tool: "tighten_prompt", tokens_in: 100, tokens_out: 60, tokens_saved: 40, model_suggestion: "standard", model_multiplier: 1, weighted_savings: 40 });

    const report = generateReport();
    expect(report.all_time.prompts_analyzed).toBe(1);
    expect(report.all_time.prompts_tightened).toBe(1);
    expect(report.all_time.tokens_saved).toBe(40);
    expect(report.all_time.weighted_savings).toBe(40);
    expect(report.by_model_tier.premium).toBe(0);
    expect(report.by_model_tier.standard).toBe(40);
  });

  it("counts today entries separately from all_time", async () => {
    const { logUsage } = await import("../src/telemetry/store.js");
    const { generateReport } = await import("../src/telemetry/reporter.js");

    // old entry (2020)
    logUsage({ ts: "2020-01-01T00:00:00.000Z", tool: "tighten_prompt", tokens_in: 200, tokens_out: 100, tokens_saved: 100, model_suggestion: "premium", model_multiplier: 3, weighted_savings: 300 });
    // today
    logUsage({ ts: new Date().toISOString(), tool: "tighten_prompt", tokens_in: 50, tokens_out: 30, tokens_saved: 20, model_suggestion: "mini", model_multiplier: 0.33, weighted_savings: 6.6 });

    const report = generateReport();
    expect(report.all_time.prompts_tightened).toBe(2);
    expect(report.today.prompts_tightened).toBe(1);
    expect(report.today.tokens_saved).toBe(20);
  });

  it("skips malformed JSONL lines gracefully", async () => {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { generateReport } = await import("../src/telemetry/reporter.js");

    writeFileSync(join(tmpDir, "usage.jsonl"), `{"ts":"2026-01-01","tool":"tighten_prompt","tokens_in":10,"tokens_out":8,"tokens_saved":2,"model_suggestion":"mini","model_multiplier":0.33,"weighted_savings":0.66}\nNOT_JSON\n`, "utf8");

    const report = generateReport();
    expect(report.all_time.prompts_tightened).toBe(1);
  });
});
