/**
 * Core scaffolding logic — reads templates and writes/merges them into the
 * target workspace directory.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// When compiled: dist/scaffolder.js → templates/ is at ../templates/
const TEMPLATES_DIR = join(__dirname, "..", "templates");

export interface ScaffoldOptions {
  mode: "balanced" | "strict";
  target: string;
  force: boolean;
}

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const { target } = opts;

  console.log(`\n🌿 EcoPilot Init — target: ${target} | mode: ${opts.mode}\n`);

  // 1. .github/copilot-instructions.md
  writeTemplate(
    join(TEMPLATES_DIR, "copilot-instructions.md"),
    join(target, ".github", "copilot-instructions.md"),
    opts,
    "copilot-instructions.md",
  );

  // 2. .github/instructions/ecopilot-routing.instructions.md
  writeTemplate(
    join(TEMPLATES_DIR, "instructions", "ecopilot-routing.instructions.md"),
    join(target, ".github", "instructions", "ecopilot-routing.instructions.md"),
    opts,
    "ecopilot-routing.instructions.md",
  );

  // 3. .github/skills/ecopilot/SKILL.md
  writeTemplate(
    join(TEMPLATES_DIR, "skills", "ecopilot", "SKILL.md"),
    join(target, ".github", "skills", "ecopilot", "SKILL.md"),
    opts,
    "SKILL.md",
  );

  // 4. .vscode/mcp.json — merge the ecopilot server entry
  patchMcpJson(target, opts);

  console.log("\nDone. Files written:");
  console.log("  .github/copilot-instructions.md");
  console.log("  .github/instructions/ecopilot-routing.instructions.md");
  console.log("  .github/skills/ecopilot/SKILL.md");
  console.log("  .vscode/mcp.json");
}

function writeTemplate(
  src: string,
  dest: string,
  opts: ScaffoldOptions,
  label: string,
): void {
  if (!existsSync(src)) {
    console.warn(`  ⚠️  Template not found: ${src}`);
    return;
  }

  let content = readFileSync(src, "utf8");

  if (opts.mode === "strict") {
    // Patch the "Balanced mode" description to "Strict mode"
    content = content.replace(/Balanced mode \(default\)/g, "Strict mode");
    content = content.replace(/Balanced mode/g, "Strict mode");
  }

  ensureDir(dirname(dest));

  if (existsSync(dest) && !opts.force) {
    // Back up before overwriting so we never lose user edits
    copyFileSync(dest, `${dest}.bak`);
    console.log(`  📦 Backed up ${label} → ${label}.bak`);
  }

  writeFileSync(dest, content, "utf8");
  console.log(`  ✏️  Wrote ${label}`);
}

function patchMcpJson(target: string, opts: ScaffoldOptions): void {
  const mcpPath = join(target, ".vscode", "mcp.json");
  const fragmentPath = join(TEMPLATES_DIR, "mcp.json.fragment");

  if (!existsSync(fragmentPath)) {
    console.warn("  ⚠️  mcp.json.fragment not found, skipping mcp.json patch");
    return;
  }

  const fragment = JSON.parse(readFileSync(fragmentPath, "utf8")) as {
    mcp: { servers: Record<string, unknown> };
  };

  ensureDir(join(target, ".vscode"));

  let existing: { mcp?: { servers?: Record<string, unknown> } } = {};

  if (existsSync(mcpPath)) {
    try {
      existing = JSON.parse(readFileSync(mcpPath, "utf8"));
    } catch {
      console.warn("  ⚠️  Could not parse existing .vscode/mcp.json — skipping merge");
      return;
    }
    if (!opts.force) {
      copyFileSync(mcpPath, `${mcpPath}.bak`);
      console.log("  📦 Backed up mcp.json → mcp.json.bak");
    }
  }

  if (!existing.mcp) existing.mcp = {};
  if (!existing.mcp.servers) existing.mcp.servers = {};

  // Merge: add ecopilot entry; never overwrite user-defined servers
  Object.assign(existing.mcp.servers, fragment.mcp.servers);

  writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  console.log("  ✏️  Patched .vscode/mcp.json");
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}
