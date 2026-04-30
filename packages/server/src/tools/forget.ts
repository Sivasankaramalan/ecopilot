/**
 * forget MCP tool — delete a key from memory.
 */

import { z } from "zod";
import { memoryDelete, type MemoryScope } from "../memory/store.js";
import { ok } from "./shared.js";

export const forgetSchema = z.object({
  key: z.string().min(1).describe("The key to delete"),
  scope: z.enum(["user", "workspace", "session"]).default("workspace").describe(
    "Scope the key lives in",
  ),
});

export type ForgetInput = z.infer<typeof forgetSchema>;

export function forgetTool(input: ForgetInput): unknown {
  const deleted = memoryDelete(input.key, input.scope as MemoryScope);
  return ok({ key: input.key, scope: input.scope, deleted });
}
