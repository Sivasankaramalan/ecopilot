/**
 * scope_check MCP tool — wraps the scope detector.
 */

import { z } from "zod";
import { checkScope } from "../hygiene/scope-detector.js";
import { ok } from "./shared.js";

export const scopeCheckSchema = z.object({
  prompt: z.string().min(1).describe("The prompt to check for overbroad scope"),
});

export type ScopeCheckInput = z.infer<typeof scopeCheckSchema>;

export function scopeCheckTool(input: ScopeCheckInput): unknown {
  const result = checkScope(input.prompt);
  return ok(result as unknown as Record<string, unknown>);
}
