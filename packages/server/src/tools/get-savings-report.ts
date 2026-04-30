/**
 * get_savings_report MCP tool — returns aggregated telemetry from usage.jsonl.
 */

import { generateReport } from "../telemetry/reporter.js";
import { ok } from "./shared.js";

export function getSavingsReportTool(): unknown {
  const report = generateReport();
  return ok(report as unknown as Record<string, unknown>);
}
