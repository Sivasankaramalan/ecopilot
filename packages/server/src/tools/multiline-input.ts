/**
 * multiline_input — collect long-form text (code, descriptions, feedback).
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok, cancelled } from "./shared.js";

export const multilineInputSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  default_value: z.string().optional(),
  timeout_secs: z.number().int().positive().optional(),
});

export type MultilineInputInput = z.infer<typeof multilineInputSchema>;

export async function multilineInputTool(
  input: MultilineInputInput,
  ui: UiDriver,
  defaultTimeoutSecs: number,
): Promise<unknown> {
  const result = await ui.multilineInput({
    title: input.title,
    prompt: input.prompt,
    ...(input.default_value !== undefined && { defaultValue: input.default_value }),
    timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
  });

  if (result === null) return cancelled();
  return ok({
    user_input: result,
    character_count: result.length,
    line_count: result.split("\n").length,
  });
}
