/**
 * Shared response schema for all EcoPilot tools.
 */

export interface ToolResponse {
  success: boolean;
  cancelled: boolean;
  error?: string;
  [key: string]: unknown;
}

export function cancelled(reason = "User cancelled or timed out"): ToolResponse {
  return { success: false, cancelled: true, error: reason };
}

export function ok(extra: Record<string, unknown>): ToolResponse {
  return { success: true, cancelled: false, ...extra };
}
