/**
 * Telemetry reporter — reads usage.jsonl and aggregates into a savings report.
 */

import { readFileSync, existsSync } from "node:fs";
import { getUsageFilePath, type UsageEntry } from "./store.js";

export interface PeriodStats {
  prompts_analyzed: number;
  prompts_tightened: number;
  tokens_analyzed: number;
  tokens_saved: number;
  /** tokens_saved × model_multiplier, i.e. premium-equivalent tokens saved */
  weighted_savings: number;
}

export interface SavingsReport {
  today: PeriodStats;
  week: PeriodStats;
  all_time: PeriodStats;
  /** weighted_savings broken down by model tier */
  by_model_tier: { mini: number; standard: number; premium: number };
  /** Absolute path to the raw log for power users */
  log_path: string;
}

function emptyStats(): PeriodStats {
  return {
    prompts_analyzed: 0,
    prompts_tightened: 0,
    tokens_analyzed: 0,
    tokens_saved: 0,
    weighted_savings: 0,
  };
}

function addEntry(stats: PeriodStats, entry: UsageEntry): void {
  if (entry.tool === "analyze_prompt") stats.prompts_analyzed++;
  if (entry.tool === "tighten_prompt") stats.prompts_tightened++;
  stats.tokens_analyzed += entry.tokens_in;
  stats.tokens_saved += entry.tokens_saved;
  stats.weighted_savings += entry.weighted_savings;
}

function dayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function generateReport(): SavingsReport {
  const logPath = getUsageFilePath();
  const entries: UsageEntry[] = [];

  if (existsSync(logPath)) {
    const raw = readFileSync(logPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as UsageEntry);
      } catch {
        // skip malformed lines
      }
    }
  }

  const now = new Date();
  const todayStart = dayStartMs(now);
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const today = emptyStats();
  const week = emptyStats();
  const allTime = emptyStats();
  const byTier = { mini: 0, standard: 0, premium: 0 };

  for (const entry of entries) {
    const t = new Date(entry.ts).getTime();
    addEntry(allTime, entry);
    if (t >= weekStart) addEntry(week, entry);
    if (t >= todayStart) addEntry(today, entry);
    const tier = entry.model_suggestion as keyof typeof byTier;
    if (tier in byTier) byTier[tier] += entry.weighted_savings;
  }

  return { today, week, all_time: allTime, by_model_tier: byTier, log_path: logPath };
}
