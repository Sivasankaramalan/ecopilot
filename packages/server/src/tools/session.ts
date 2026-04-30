/**
 * Session tools — start_session / ask_in_session / end_session.
 *
 * An "intensive session" keeps a persistent multi-turn dialogue alive inside
 * a single premium request. The AI can ask multiple questions sequentially
 * without restarting the Copilot session each time.
 *
 * Session state is held in-memory on the server (not persisted to disk
 * in this v1 implementation).
 */

import { z } from "zod";
import type { UiDriver } from "../ui/driver.js";
import { ok, cancelled } from "./shared.js";

interface SessionEntry {
  id: string;
  history: Array<{ role: "agent" | "user"; content: string }>;
  createdAt: number;
}

// Session registry — keyed by session_id.
const sessions = new Map<string, SessionEntry>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── start_session ─────────────────────────────────────────────────────────────

export const startSessionSchema = z.object({
  context: z.string().optional().describe("Optional context / system message for the session"),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;

export function startSessionTool(input: StartSessionInput): unknown {
  const id = makeId();
  sessions.set(id, {
    id,
    history: input.context ? [{ role: "agent", content: input.context }] : [],
    createdAt: Date.now(),
  });
  return ok({ session_id: id, message: "Session started. Use ask_in_session to interact." });
}

// ── ask_in_session ────────────────────────────────────────────────────────────

export const askInSessionSchema = z.object({
  session_id: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(z.string()).optional().describe("Optional predefined choices"),
  timeout_secs: z.number().int().positive().optional(),
});

export type AskInSessionInput = z.infer<typeof askInSessionSchema>;

export async function askInSessionTool(
  input: AskInSessionInput,
  ui: UiDriver,
  defaultTimeoutSecs: number,
): Promise<unknown> {
  const session = sessions.get(input.session_id);
  if (!session) {
    return { success: false, cancelled: false, error: `Session ${input.session_id} not found` };
  }

  session.history.push({ role: "agent", content: input.prompt });

  let result: string | null;

  if (input.choices && input.choices.length > 0) {
    result = await ui.chooseOne({
      title: "EcoPilot Session",
      prompt: input.prompt,
      choices: input.choices,
      timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
    });
  } else {
    result = await ui.askUser({
      title: "EcoPilot Session",
      prompt: input.prompt,
      inputType: "text",
      timeoutSecs: input.timeout_secs ?? defaultTimeoutSecs,
    });
  }

  if (result === null) return cancelled();
  session.history.push({ role: "user", content: result });
  return ok({ user_input: result, session_id: input.session_id });
}

// ── end_session ───────────────────────────────────────────────────────────────

export const endSessionSchema = z.object({
  session_id: z.string().min(1),
});

export type EndSessionInput = z.infer<typeof endSessionSchema>;

export function endSessionTool(input: EndSessionInput): unknown {
  const session = sessions.get(input.session_id);
  if (!session) {
    return { success: false, cancelled: false, error: `Session ${input.session_id} not found` };
  }
  const turns = session.history.filter((h) => h.role === "user").length;
  sessions.delete(input.session_id);
  return ok({
    session_id: input.session_id,
    turns,
    message: `Session ended. ${turns} user turn(s) handled without consuming additional premium requests.`,
  });
}
