import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold } from "../src/scaffolder.js";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "ecopilot-test-"));
}

describe("scaffolder", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("writes all expected files", async () => {
    const target = tempDir();
    dirs.push(target);
    await scaffold({ mode: "balanced", target, force: false });

    expect(existsSync(join(target, ".github", "copilot-instructions.md"))).toBe(true);
    expect(existsSync(join(target, ".github", "instructions", "ecopilot-routing.instructions.md"))).toBe(true);
    expect(existsSync(join(target, ".github", "skills", "ecopilot", "SKILL.md"))).toBe(true);
    expect(existsSync(join(target, ".vscode", "mcp.json"))).toBe(true);
  });

  it("mcp.json contains ecopilot server entry", async () => {
    const target = tempDir();
    dirs.push(target);
    await scaffold({ mode: "balanced", target, force: false });

    const mcp = JSON.parse(readFileSync(join(target, ".vscode", "mcp.json"), "utf8"));
    expect(mcp.mcp.servers).toHaveProperty("ecopilot");
    expect(mcp.mcp.servers.ecopilot.command).toBe("npx");
  });

  it("preserves existing mcp.json entries", async () => {
    const target = tempDir();
    dirs.push(target);

    // Pre-populate mcp.json with a user-defined server
    const vscodePath = join(target, ".vscode");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(vscodePath, { recursive: true });
    writeFileSync(
      join(vscodePath, "mcp.json"),
      JSON.stringify({ mcp: { servers: { "my-server": { command: "node", args: [] } } } }),
    );

    await scaffold({ mode: "balanced", target, force: true });
    const mcp = JSON.parse(readFileSync(join(target, ".vscode", "mcp.json"), "utf8"));
    expect(mcp.mcp.servers).toHaveProperty("my-server");
    expect(mcp.mcp.servers).toHaveProperty("ecopilot");
  });

  it("idempotent — second run does not throw", async () => {
    const target = tempDir();
    dirs.push(target);
    await scaffold({ mode: "balanced", target, force: false });
    await expect(scaffold({ mode: "balanced", target, force: false })).resolves.toBeUndefined();
  });

  it("strict mode patches copilot-instructions.md content", async () => {
    const target = tempDir();
    dirs.push(target);
    await scaffold({ mode: "strict", target, force: false });
    const content = readFileSync(join(target, ".github", "copilot-instructions.md"), "utf8");
    expect(content).not.toContain("Balanced mode (default)");
  });
});
