import { describe, it, expect, vi } from "vitest";
import type { UiDriver } from "../src/ui/driver.js";
import { askUserTool } from "../src/tools/ask-user.js";
import { chooseOneTool } from "../src/tools/choose-one.js";
import { chooseManyTool } from "../src/tools/choose-many.js";
import { confirmTool } from "../src/tools/confirm.js";
import { notifyTool } from "../src/tools/notify.js";
import { startSessionTool, askInSessionTool, endSessionTool } from "../src/tools/session.js";

/** Creates a mock UiDriver */
function mockDriver(overrides: Partial<UiDriver> = {}): UiDriver {
  return {
    askUser: vi.fn().mockResolvedValue("mock-answer"),
    chooseOne: vi.fn().mockResolvedValue("Option A"),
    chooseMany: vi.fn().mockResolvedValue(["Option A", "Option B"]),
    multilineInput: vi.fn().mockResolvedValue("multi\nline"),
    confirm: vi.fn().mockResolvedValue(true),
    notify: vi.fn(),
    ...overrides,
  };
}

describe("ask_user", () => {
  it("returns user_input on success", async () => {
    const ui = mockDriver();
    const result = await askUserTool({ title: "T", prompt: "P", input_type: "text" }, ui, 30) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.user_input).toBe("mock-answer");
  });

  it("returns cancelled when driver returns null", async () => {
    const ui = mockDriver({ askUser: vi.fn().mockResolvedValue(null) });
    const result = await askUserTool({ title: "T", prompt: "P", input_type: "text" }, ui, 30) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
  });
});

describe("choose_one", () => {
  it("returns selected_choice", async () => {
    const ui = mockDriver();
    const result = await chooseOneTool({ title: "T", prompt: "P", choices: ["Option A", "Option B"] }, ui, 30) as Record<string, unknown>;
    expect(result.selected_choice).toBe("Option A");
  });
});

describe("choose_many", () => {
  it("returns selected_choices array", async () => {
    const ui = mockDriver();
    const result = await chooseManyTool({ title: "T", prompt: "P", choices: ["Option A", "Option B"] }, ui, 30) as Record<string, unknown>;
    expect(result.selected_choices).toEqual(["Option A", "Option B"]);
  });

  it("returns cancelled on empty selection", async () => {
    const ui = mockDriver({ chooseMany: vi.fn().mockResolvedValue([]) });
    const result = await chooseManyTool({ title: "T", prompt: "P", choices: ["A"] }, ui, 30) as Record<string, unknown>;
    expect(result.cancelled).toBe(true);
  });
});

describe("confirm", () => {
  it("returns confirmed true on yes", async () => {
    const ui = mockDriver();
    const result = await confirmTool({ title: "T", message: "M" }, ui, 30) as Record<string, unknown>;
    expect(result.confirmed).toBe(true);
    expect(result.response).toBe("yes");
  });

  it("returns confirmed false on no", async () => {
    const ui = mockDriver({ confirm: vi.fn().mockResolvedValue(false) });
    const result = await confirmTool({ title: "T", message: "M" }, ui, 30) as Record<string, unknown>;
    expect(result.confirmed).toBe(false);
    expect(result.response).toBe("no");
  });
});

describe("notify", () => {
  it("calls ui.notify and returns acknowledged", () => {
    const ui = mockDriver();
    const result = notifyTool({ title: "T", message: "M" }, ui) as Record<string, unknown>;
    expect(result.acknowledged).toBe(true);
    expect(ui.notify).toHaveBeenCalledWith({ title: "T", message: "M" });
  });
});

describe("sessions", () => {
  it("full start → ask → end lifecycle", async () => {
    const ui = mockDriver();
    const started = startSessionTool({}) as Record<string, unknown>;
    expect(started.success).toBe(true);
    const sessionId = started["session_id"] as string;

    const asked = await askInSessionTool({ session_id: sessionId, prompt: "Q?" }, ui, 30) as Record<string, unknown>;
    expect(asked.user_input).toBe("mock-answer");

    const ended = endSessionTool({ session_id: sessionId }) as Record<string, unknown>;
    expect(ended.turns).toBe(1);
  });

  it("returns error for unknown session_id", () => {
    const result = endSessionTool({ session_id: "nonexistent" }) as Record<string, unknown>;
    expect(result.success).toBe(false);
  });
});
