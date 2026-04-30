/**
 * UI driver factory — picks the right driver based on config.uiMode.
 *
 * "auto" → tries extension bridge first; terminal fallback is embedded in
 *           ExtensionBridgeDriver, so "auto" and "extension" are the same here.
 * "terminal" → plain readline prompts.
 * "notify"   → OS notification + terminal fallback (not yet implemented, falls
 *               back to terminal).
 */

import { platform } from "node:os";
import type { EcoPilotConfig } from "../config.js";
import type { UiDriver } from "./driver.js";
import { TerminalUiDriver } from "./terminal-driver.js";
import { ExtensionBridgeDriver } from "./extension-bridge-driver.js";
import { MacOsDialogDriver } from "./macos-dialog-driver.js";
import type { Logger } from "../logger.js";

/**
 * Pick the best standalone (non-extension) driver for the current platform.
 *
 * IMPORTANT: The MCP server runs over stdio, so the TerminalUiDriver's
 * readline approach competes with the MCP transport for process.stdin and
 * will deadlock. On macOS we use osascript dialogs instead; the terminal
 * driver is kept only as a last-resort fallback for non-macOS platforms
 * where no native dialog is available yet.
 */
export function createStandaloneDriver(): UiDriver {
  if (platform() === "darwin") return new MacOsDialogDriver();
  // Linux / Windows: terminal driver (works when the process has a real tty,
  // e.g. started from a terminal manually rather than from VS Code MCP host).
  return new TerminalUiDriver();
}

export function createUiDriver(config: EcoPilotConfig, logger: Logger): UiDriver {
  if (config.uiMode === "terminal") {
    logger.info("UI mode: terminal (note: may hang in VS Code MCP stdio context)");
    return new TerminalUiDriver();
  }
  // "auto" | "extension" | "notify" all start the bridge (notify = future work)
  const fallback = createStandaloneDriver();
  const fallbackName = fallback instanceof MacOsDialogDriver ? "osascript" : "terminal";
  logger.info(`UI mode: ${config.uiMode} (extension bridge + ${fallbackName} fallback)`);
  return new ExtensionBridgeDriver(logger, config.extensionPort, fallback);
}
