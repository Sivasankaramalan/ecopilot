/**
 * EcoPilot server configuration — resolved once at startup from CLI flags
 * and environment variables.
 */

export type UiMode = "auto" | "extension" | "terminal" | "notify";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface EcoPilotConfig {
  /** Seconds before a tool call times out. Default: 300 (5 min). */
  timeoutSecs: number;
  /** How to surface dialogs to the user. Default: "auto". */
  uiMode: UiMode;
  /** Tool names to skip registering. */
  disabledTools: string[];
  /** Logging verbosity. Default: "info". */
  logLevel: LogLevel;
  /** Local WebSocket port for extension bridge. 0 = OS-chosen. Default: 0. */
  extensionPort: number;
}

const VALID_UI_MODES = new Set<UiMode>(["auto", "extension", "terminal", "notify"]);
const VALID_LOG_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

function isUiMode(v: string): v is UiMode {
  return VALID_UI_MODES.has(v as UiMode);
}
function isLogLevel(v: string): v is LogLevel {
  return VALID_LOG_LEVELS.has(v as LogLevel);
}

export function resolveConfig(overrides: Partial<{
  timeoutSecs: number;
  uiMode: string;
  disabledTools: string[];
  logLevel: string;
  extensionPort: number;
}>): EcoPilotConfig {
  const uiModeRaw = overrides.uiMode ?? process.env["ECOPILOT_UI_MODE"] ?? "auto";
  const logLevelRaw = overrides.logLevel ?? process.env["ECOPILOT_LOG_LEVEL"] ?? "info";

  return {
    timeoutSecs: overrides.timeoutSecs ?? Number(process.env["ECOPILOT_TIMEOUT"] ?? "300"),
    uiMode: isUiMode(uiModeRaw) ? uiModeRaw : "auto",
    disabledTools: overrides.disabledTools ?? [],
    logLevel: isLogLevel(logLevelRaw) ? logLevelRaw : "info",
    extensionPort: overrides.extensionPort ?? Number(process.env["ECOPILOT_PORT"] ?? "0"),
  };
}
