/**
 * ask_user — collect single-line input (text / integer / float).
 *
 * This is the most-used tool. Every time Copilot calls this instead of
 * posting a follow-up message, one premium request is saved.
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok, cancelled } from "./shared.js";

export const askUserSchema = z.object({
  title: z.string().min(1).describe("Dialog window title"),
  prompt: z.string().min(1).describe("Question or prompt text shown to the user"),
  default_value: z.string().optional().describe("Pre-filled value (optional)"),
  input_type: z
    .enum(["text", "integer", "float"])
    .default("text")
    .describe("Type of input to validate"),
  timeout_secs: z.number().int().positive().optional().describe("Override timeout in seconds"),
});

export type AskUserInput = z.infer<typeof askUserSchema>;

export async function askUserTool(
  input: AskUserInput,
  ui: UiDriver,
  defaultTimeoutSecs: number,
): Promise<unknown> {
  const result = await ui.askUser({
    title: input.title,
    prompt: input.prompt,
    ...(input.default_value !== undefined && { defaultValue: input.default_value }),
    inputType: input.input_type,
    timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
  });

  if (result === null) return cancelled();
  return ok({ user_input: result, input_type: input.input_type });
}
