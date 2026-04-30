/**
 * remember MCP tool — save a key-value pair to persistent memory.
 */

import { z } from "zod";
import { memorySet, type MemoryScope } from "../memory/store.js";
import { ok } from "./shared.js";

export const rememberSchema = z.object({
  key: z.string().min(1).describe("A short unique name for this memory (e.g. 'preferred_language', 'api_base_url')"),
  value: z.string().min(1).describe("The value to store"),
  scope: z.enum(["user", "workspace", "session"]).default("workspace").describe(
    "user = persists across all projects; workspace = persists for this project only; session = in-memory, cleared on restart",
  ),
});

export type RememberInput = z.infer<typeof rememberSchema>;

export function rememberTool(input: RememberInput): unknown {
  memorySet(input.key, input.value, input.scope as MemoryScope);
  return ok({ key: input.key, scope: input.scope, stored: true });
}
