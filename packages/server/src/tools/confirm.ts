/**
 * confirm — yes/no decision before a potentially destructive or irreversible action.
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok, cancelled } from "./shared.js";

export const confirmSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1).describe("Describe the action requiring confirmation"),
  timeout_secs: z.number().int().positive().optional(),
});

export type ConfirmInput = z.infer<typeof confirmSchema>;

export async function confirmTool(
  input: ConfirmInput,
  ui: UiDriver,
  defaultTimeoutSecs: number,
): Promise<unknown> {
  const result = await ui.confirm({
    title: input.title,
    message: input.message,
    timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
  });

  if (result === null) return cancelled();
  return ok({ confirmed: result, response: result ? "yes" : "no" });
}
