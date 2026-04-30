/**
 * notify — fire-and-forget status message; never blocks the agent turn.
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok } from "./shared.js";

export const notifySchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
});

export type NotifyInput = z.infer<typeof notifySchema>;

export function notifyTool(input: NotifyInput, ui: UiDriver): unknown {
  ui.notify({ title: input.title, message: input.message });
  return ok({ acknowledged: true });
}
