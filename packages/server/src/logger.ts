/**
 * EcoPilot logger — thin wrapper that prefixes every message with the
 * level and timestamps, and writes to stderr so it never pollutes the
 * MCP stdio transport on stdout.
 */

import type { LogLevel } from "./config.js";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  constructor(private readonly minLevel: LogLevel = "info") {}

  debug(msg: string): void { this.write("debug", msg); }
  info(msg: string): void  { this.write("info",  msg); }
  warn(msg: string): void  { this.write("warn",  msg); }
  error(msg: string): void { this.write("error", msg); }

  private write(level: LogLevel, msg: string): void {
    if (LEVELS[level] < LEVELS[this.minLevel]) return;
    const ts = new Date().toISOString();
    process.stderr.write(`[${ts}] [ecopilot] [${level.toUpperCase()}] ${msg}\n`);
  }
}
