import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ecopilot-mem-test-"));
  process.env["ECOPILOT_DATA_DIR"] = tmpDir;
});
afterEach(() => {
  delete process.env["ECOPILOT_DATA_DIR"];
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── memory store ──────────────────────────────────────────────────────────────

describe("memory store", () => {
  it("stores and retrieves a user-scope value", async () => {
    const { memorySet, memoryGet } = await import("../src/memory/store.js");
    memorySet("lang", "TypeScript", "user");
    const entry = memoryGet("lang", "user");
    expect(entry?.value).toBe("TypeScript");
    expect(entry?.scope).toBe("user");
  });

  it("stores and retrieves a workspace-scope value", async () => {
    const { memorySet, memoryGet } = await import("../src/memory/store.js");
    memorySet("api_url", "http://localhost:3000", "workspace");
    const entry = memoryGet("api_url", "workspace");
    expect(entry?.value).toBe("http://localhost:3000");
  });

  it("session scope is in-memory only", async () => {
    const { memorySet, memoryGet } = await import("../src/memory/store.js");
    memorySet("token", "abc123", "session");
    expect(memoryGet("token", "session")?.value).toBe("abc123");
    // user scope should not see it
    expect(memoryGet("token", "user")).toBeUndefined();
  });

  it("lists all keys in a scope", async () => {
    const { memorySet, memoryList } = await import("../src/memory/store.js");
    memorySet("a", "1", "user");
    memorySet("b", "2", "user");
    const all = memoryList("user");
    expect(Object.keys(all)).toContain("a");
    expect(Object.keys(all)).toContain("b");
  });

  it("deletes a key", async () => {
    const { memorySet, memoryGet, memoryDelete } = await import("../src/memory/store.js");
    memorySet("x", "hello", "user");
    expect(memoryDelete("x", "user")).toBe(true);
    expect(memoryGet("x", "user")).toBeUndefined();
  });

  it("returns false when deleting a nonexistent key", async () => {
    const { memoryDelete } = await import("../src/memory/store.js");
    expect(memoryDelete("nope", "user")).toBe(false);
  });

  it("user and workspace scopes are independent", async () => {
    const { memorySet, memoryGet } = await import("../src/memory/store.js");
    memorySet("key", "user-value", "user");
    memorySet("key", "workspace-value", "workspace");
    expect(memoryGet("key", "user")?.value).toBe("user-value");
    expect(memoryGet("key", "workspace")?.value).toBe("workspace-value");
  });

  it("overwrites an existing key", async () => {
    const { memorySet, memoryGet } = await import("../src/memory/store.js");
    memorySet("env", "dev", "user");
    memorySet("env", "prod", "user");
    expect(memoryGet("env", "user")?.value).toBe("prod");
  });
});

// ── suggest_model ─────────────────────────────────────────────────────────────

describe("suggestModelTool", () => {
  it("suggests mini for a trivial prompt", async () => {
    const { suggestModelTool } = await import("../src/tools/suggest-model.js");
    const result = await suggestModelTool({ prompt: "What is a closure?" }) as Record<string, unknown>;
    expect(result["suggested_model"]).toBe("mini");
    expect(result["cost_multiplier"]).toBe(0.33);
  });

  it("suggests premium for an architecture prompt", async () => {
    const { suggestModelTool } = await import("../src/tools/suggest-model.js");
    const result = await suggestModelTool({ prompt: "Architect a microservice system from scratch for our e-commerce platform" }) as Record<string, unknown>;
    expect(result["suggested_model"]).toBe("premium");
  });

  it("emits a warning when current_model is overkill", async () => {
    const { suggestModelTool } = await import("../src/tools/suggest-model.js");
    const result = await suggestModelTool({
      prompt: "What is a closure?",
      current_model: "premium",
    }) as Record<string, unknown>;
    expect(result["warning"]).toMatch(/premium/);
    expect((result["downgrade_saves_pct"] as number)).toBeGreaterThan(0);
  });

  it("emits a notice when current_model is underpowered", async () => {
    const { suggestModelTool } = await import("../src/tools/suggest-model.js");
    const result = await suggestModelTool({
      prompt: "Architect a microservice system from scratch",
      current_model: "mini",
    }) as Record<string, unknown>;
    expect(result["notice"]).toMatch(/mini/);
  });

  it("no warning when current_model matches suggestion", async () => {
    const { suggestModelTool } = await import("../src/tools/suggest-model.js");
    const result = await suggestModelTool({
      prompt: "What is a closure?",
      current_model: "mini",
    }) as Record<string, unknown>;
    expect(result["warning"]).toBeUndefined();
    expect(result["notice"]).toBeUndefined();
  });

  it("flags vague phrases and includes a tip", async () => {
    const { suggestModelTool } = await import("../src/tools/suggest-model.js");
    const result = await suggestModelTool({
      prompt: "Can you please just simply help me fix it",
    }) as Record<string, unknown>;
    expect(result["vague_phrases_detected"]).toBeDefined();
    expect(result["tip"]).toMatch(/tighten_prompt/);
  });
});
