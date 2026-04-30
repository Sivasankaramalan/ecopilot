/**
 * recall MCP tool — retrieve a value (or list all keys) from memory.
 */

import { z } from "zod";
import { memoryGet, memoryList, type MemoryScope } from "../memory/store.js";
import { ok } from "./shared.js";

export const recallSchema = z.object({
  key: z.string().optional().describe("The key to look up. Omit to list ALL keys in this scope."),
  scope: z.enum(["user", "workspace", "session"]).default("workspace").describe(
    "Scope to search in. Defaults to workspace.",
  ),
});

export type RecallInput = z.infer<typeof recallSchema>;

export function recallTool(input: RecallInput): unknown {
  const scope = input.scope as MemoryScope;

  if (!input.key) {
    const all = memoryList(scope);
    const keys = Object.entries(all).map(([k, e]) => ({
      key: k,
      value: e.value,
      saved_at: e.saved_at,
    }));
    return ok({ scope, keys, count: keys.length });
  }

  const entry = memoryGet(input.key, scope);
  if (!entry) {
    return ok({ key: input.key, scope, found: false, value: null });
  }
  return ok({ key: input.key, scope, found: true, value: entry.value, saved_at: entry.saved_at });
}
