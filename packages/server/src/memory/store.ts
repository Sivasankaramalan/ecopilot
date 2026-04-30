/**
 * Persistent key-value memory store.
 *
 * Backed by ~/.ecopilot/memory.json (or $ECOPILOT_DATA_DIR/memory.json).
 * Three scopes:
 *   "user"      — survives forever across all projects
 *   "workspace" — keyed per cwd, survives server restarts
 *   "session"   — in-memory only, cleared on server restart
 *
 * File format:
 *   { "user": { key: MemoryEntry }, "workspace": { "<cwd>": { key: MemoryEntry } } }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "../telemetry/store.js";

export type MemoryScope = "user" | "workspace" | "session";

export interface MemoryEntry {
  value: string;
  saved_at: string;
  scope: MemoryScope;
}

// ── In-memory session store (cleared on restart) ──────────────────────────────

const sessionStore = new Map<string, MemoryEntry>();

// ── Persistent file helpers ───────────────────────────────────────────────────

interface PersistedMemory {
  user: Record<string, MemoryEntry>;
  workspace: Record<string, Record<string, MemoryEntry>>;
}

function getMemoryFilePath(): string {
  return join(getDataDir(), "memory.json");
}

function readFile(): PersistedMemory {
  const path = getMemoryFilePath();
  if (!existsSync(path)) return { user: {}, workspace: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PersistedMemory;
  } catch {
    return { user: {}, workspace: {} };
  }
}

function writeFile(data: PersistedMemory): void {
  const dir = getDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getMemoryFilePath(), JSON.stringify(data, null, 2), "utf8");
}

function workspaceKey(): string {
  return process.cwd();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function memorySet(key: string, value: string, scope: MemoryScope): void {
  const entry: MemoryEntry = { value, saved_at: new Date().toISOString(), scope };

  if (scope === "session") {
    sessionStore.set(key, entry);
    return;
  }

  const data = readFile();
  if (scope === "user") {
    data.user[key] = entry;
  } else {
    const ws = workspaceKey();
    data.workspace[ws] ??= {};
    data.workspace[ws]![key] = entry;
  }
  writeFile(data);
}

export function memoryGet(key: string, scope: MemoryScope): MemoryEntry | undefined {
  if (scope === "session") return sessionStore.get(key);

  const data = readFile();
  if (scope === "user") return data.user[key];
  return data.workspace[workspaceKey()]?.[key];
}

export function memoryList(scope: MemoryScope): Record<string, MemoryEntry> {
  if (scope === "session") return Object.fromEntries(sessionStore.entries());

  const data = readFile();
  if (scope === "user") return data.user;
  return data.workspace[workspaceKey()] ?? {};
}

export function memoryDelete(key: string, scope: MemoryScope): boolean {
  if (scope === "session") return sessionStore.delete(key);

  const data = readFile();
  if (scope === "user") {
    if (!(key in data.user)) return false;
    delete data.user[key];
  } else {
    const ws = workspaceKey();
    if (!data.workspace[ws] || !(key in data.workspace[ws]!)) return false;
    delete data.workspace[ws]![key];
  }
  writeFile(data);
  return true;
}
