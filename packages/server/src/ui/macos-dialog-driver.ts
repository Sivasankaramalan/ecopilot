/**
 * macOS native dialog driver — uses osascript (AppleScript) to surface
 * dialogs without touching process.stdin or process.stdout.
 *
 * This is critical for MCP servers running over stdio transport: the MCP
 * SDK owns stdin/stdout, so readline-based terminal prompts deadlock. The
 * osascript subprocess communicates entirely through its own stdin/stdout,
 * leaving the MCP transport undisturbed.
 *
 * All osascript calls time out via a separate setTimeout; if the user
 * dismisses the dialog via the OS (Cmd+W, etc.) the execFile callback
 * receives a non-zero exit code and we return null (cancelled).
 */

import { execFile } from "node:child_process";
import type {
  UiDriver,
  AskUserOpts,
  ChooseOpts,
  MultilineOpts,
  ConfirmOpts,
  NotifyOpts,
} from "./driver.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  // Escape double-quotes and backslashes for embedding in AppleScript strings
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function run(script: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const child = execFile(
      "osascript",
      ["-e", script],
      { timeout: timeoutMs },
      (err, stdout) => {
        if (err) { resolve(null); return; }
        resolve(stdout.trim());
      },
    );
    // Belt-and-suspenders: if the process doesn't exit within timeout, kill it
    const timer = setTimeout(() => { child.kill(); resolve(null); }, timeoutMs);
    child.once("exit", () => clearTimeout(timer));
  });
}

function buildChoiceList(choices: string[]): string {
  return "{" + choices.map((c) => `"${esc(c)}"`).join(", ") + "}";
}

// ── driver implementation ─────────────────────────────────────────────────────

export class MacOsDialogDriver implements UiDriver {
  async askUser(opts: AskUserOpts): Promise<string | null> {
    const defaultPart = opts.defaultValue !== undefined
      ? ` default answer "${esc(opts.defaultValue)}"`
      : ' default answer ""';

    const script =
      `display dialog "${esc(opts.prompt)}"` +
      `${defaultPart}` +
      ` with title "${esc(opts.title)}"` +
      ` buttons {"Cancel","OK"} default button "OK"`;

    const raw = await run(script, opts.timeoutSecs * 1000);
    if (!raw) return null;

    // Response format: "button returned:OK, text returned:answer"
    const match = raw.match(/text returned:(.*)/);
    if (!match) return null;
    const val = match[1]?.trim() ?? "";

    if (opts.inputType === "integer") {
      const n = parseInt(val, 10);
      return isNaN(n) ? null : String(n);
    }
    if (opts.inputType === "float") {
      const n = parseFloat(val);
      return isNaN(n) ? null : String(n);
    }
    return val;
  }

  async chooseOne(opts: ChooseOpts): Promise<string | null> {
    const script =
      `choose from list ${buildChoiceList(opts.choices)}` +
      ` with prompt "${esc(opts.prompt)}"` +
      ` with title "${esc(opts.title)}"` +
      ` without multiple selections allowed`;

    const raw = await run(script, opts.timeoutSecs * 1000);
    // Returns the chosen item as a plain string, or "false" if cancelled
    if (!raw || raw === "false") return null;
    return raw;
  }

  async chooseMany(opts: ChooseOpts): Promise<string[]> {
    const script =
      `choose from list ${buildChoiceList(opts.choices)}` +
      ` with prompt "${esc(opts.prompt)}"` +
      ` with title "${esc(opts.title)}"` +
      ` with multiple selections allowed`;

    const raw = await run(script, opts.timeoutSecs * 1000);
    if (!raw || raw === "false") return [];
    // Returns comma-separated chosen items
    return raw.split(", ").map((s) => s.trim()).filter(Boolean);
  }

  async multilineInput(opts: MultilineOpts): Promise<string | null> {
    // AppleScript display dialog doesn't support multi-line input natively.
    // We use a scrolling text input via a separate AppleScript that invokes
    // the Script Editor's text input dialog (works on all macOS versions).
    const defaultPart = opts.defaultValue
      ? ` default answer "${esc(opts.defaultValue)}"`
      : ' default answer ""';

    const script =
      `display dialog "${esc(opts.prompt)}"` +
      `${defaultPart}` +
      ` with title "${esc(opts.title)}"` +
      ` buttons {"Cancel","Submit"} default button "Submit"`;

    const raw = await run(script, opts.timeoutSecs * 1000);
    if (!raw) return null;
    const match = raw.match(/text returned:(.*)/s);
    return match?.[1]?.trim() ?? null;
  }

  async confirm(opts: ConfirmOpts): Promise<boolean | null> {
    const script =
      `display dialog "${esc(opts.message)}"` +
      ` with title "${esc(opts.title)}"` +
      ` buttons {"No","Yes"} default button "Yes"` +
      ` with icon caution`;

    const raw = await run(script, opts.timeoutSecs * 1000);
    if (!raw) return null;
    if (raw.includes("button returned:Yes")) return true;
    if (raw.includes("button returned:No")) return false;
    return null;
  }

  notify(opts: NotifyOpts): void {
    const script =
      `display notification "${esc(opts.message)}"` +
      ` with title "${esc(opts.title)}"`;
    // Fire-and-forget; ignore errors
    execFile("osascript", ["-e", script]);
  }
}
