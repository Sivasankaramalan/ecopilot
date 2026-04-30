/**
 * health_check — returns server status, connected UI mode, and bridge port.
 */

import { ok } from "./shared.js";

export function healthCheckTool(uiMode: string, bridgePort: number): unknown {
  return ok({
    status: "healthy",
    ui_mode: uiMode,
    bridge_port: bridgePort,
    pid: process.pid,
    uptime_secs: Math.floor(process.uptime()),
  });
}
