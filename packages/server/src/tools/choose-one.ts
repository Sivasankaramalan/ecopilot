/**
 * choose_one — single-select from a list of predefined options.
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok, cancelled } from "./shared.js";

export const chooseOneSchema = z.object({
  title: z.string().min(1).describe("Dialog window title"),
  prompt: z.string().min(1).describe("Question text shown above the options"),
  choices: z.array(z.string().min(1)).min(1).describe("Available options"),
  timeout_secs: z.number().int().positive().optional(),
});

export type ChooseOneInput = z.infer<typeof chooseOneSchema>;

export async function chooseOneTool(
  input: ChooseOneInput,
  ui: UiDriver,
  defaultTimeoutSecs: number,
): Promise<unknown> {
  const result = await ui.chooseOne({
    title: input.title,
    prompt: input.prompt,
    choices: input.choices,
    timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
  });

  if (result === null) return cancelled();
  return ok({ selected_choice: result });
}
