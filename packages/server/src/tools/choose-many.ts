/**
 * choose_many — multi-select from a list of predefined options.
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok, cancelled } from "./shared.js";

export const chooseManySchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(z.string().min(1)).min(1),
  timeout_secs: z.number().int().positive().optional(),
});

export type ChooseManyInput = z.infer<typeof chooseManySchema>;

export async function chooseManyTool(
  input: ChooseManyInput,
  ui: UiDriver,
  defaultTimeoutSecs: number,
): Promise<unknown> {
  const results = await ui.chooseMany({
    title: input.title,
    prompt: input.prompt,
    choices: input.choices,
    timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
  });

  if (results.length === 0) return cancelled("No items selected or timed out");
  return ok({ selected_choices: results, count: results.length });
}
