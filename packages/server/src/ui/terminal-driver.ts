/**
 * Terminal UI driver — renders prompts directly in the stdio terminal.
 * Used when the EcoPilot VS Code extension is not connected.
 */

import * as readline from "node:readline";
import type { UiDriver, AskUserOpts, ChooseOpts, MultilineOpts, ConfirmOpts, NotifyOpts } from "./driver.js";

function prompt(question: string, timeoutSecs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        rl.close();
        resolve(null);
      }
    }, timeoutSecs * 1000);

    rl.question(question, (answer) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        rl.close();
        resolve(answer);
      }
    });
  });
}

export class TerminalUiDriver implements UiDriver {
  async askUser(opts: AskUserOpts): Promise<string | null> {
    const def = opts.defaultValue ? ` [${opts.defaultValue}]` : "";
    const raw = await prompt(`\n[EcoPilot] ${opts.title}\n${opts.prompt}${def}: `, opts.timeoutSecs);
    if (raw === null) return null;
    const val = raw.trim() || opts.defaultValue || "";

    if (opts.inputType === "integer") {
      const n = parseInt(val, 10);
      if (isNaN(n)) return null;
      return String(n);
    }
    if (opts.inputType === "float") {
      const n = parseFloat(val);
      if (isNaN(n)) return null;
      return String(n);
    }
    return val;
  }

  async chooseOne(opts: ChooseOpts): Promise<string | null> {
    const list = opts.choices.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
    const raw = await prompt(
      `\n[EcoPilot] ${opts.title}\n${opts.prompt}\n${list}\nEnter number: `,
      opts.timeoutSecs,
    );
    if (raw === null) return null;
    const idx = parseInt(raw.trim(), 10) - 1;
    return opts.choices[idx] ?? null;
  }

  async chooseMany(opts: ChooseOpts): Promise<string[]> {
    const list = opts.choices.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
    const raw = await prompt(
      `\n[EcoPilot] ${opts.title}\n${opts.prompt}\n${list}\nEnter numbers (comma-separated): `,
      opts.timeoutSecs,
    );
    if (raw === null) return [];
    return raw
      .split(",")
      .map((s) => opts.choices[parseInt(s.trim(), 10) - 1])
      .filter((c): c is string => typeof c === "string");
  }

  async multilineInput(opts: MultilineOpts): Promise<string | null> {
    process.stderr.write(
      `\n[EcoPilot] ${opts.title}\n${opts.prompt}\n(Type your response. End with a line containing only "END")\n`,
    );
    const lines: string[] = [];
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; rl.close(); resolve(null); }
      }, opts.timeoutSecs * 1000);

      rl.on("line", (line) => {
        if (line.trim() === "END") {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            rl.close();
            resolve(lines.join("\n"));
          }
        } else {
          lines.push(line);
        }
      });
    });
  }

  async confirm(opts: ConfirmOpts): Promise<boolean | null> {
    const raw = await prompt(
      `\n[EcoPilot] ${opts.title}\n${opts.message}\n[y/n]: `,
      opts.timeoutSecs,
    );
    if (raw === null) return null;
    const v = raw.trim().toLowerCase();
    if (v === "y" || v === "yes") return true;
    if (v === "n" || v === "no") return false;
    return null;
  }

  notify(opts: NotifyOpts): void {
    process.stderr.write(`\n[EcoPilot] ${opts.title}: ${opts.message}\n`);
  }
}
