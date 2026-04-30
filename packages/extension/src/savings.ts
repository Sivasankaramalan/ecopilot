/**
 * savings.ts — reads ~/.ecopilot/usage.jsonl for status bar + dashboard.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface UsageEntry {
  ts: string;
  tool: string;
  tokens_in: number;
  tokens_out: number;
  tokens_saved: number;
  model_suggestion: string;
  model_multiplier: number;
  weighted_savings: number;
}

export interface PeriodStats {
  prompts_analyzed: number;
  prompts_tightened: number;
  tokens_saved: number;
  weighted_savings: number;
}

export interface FullReport {
  today: PeriodStats;
  week: PeriodStats;
  all_time: PeriodStats;
  by_model: { mini: number; standard: number; premium: number };
  /** Last 30 days bucketed by date string "YYYY-MM-DD" → tokens_saved */
  daily: Record<string, number>;
  log_path: string;
}

function todayStartMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dataDir(): string {
  return process.env["ECOPILOT_DATA_DIR"] ?? join(homedir(), ".ecopilot");
}

function usagePath(): string {
  return join(dataDir(), "usage.jsonl");
}

function emptyStats(): PeriodStats {
  return { prompts_analyzed: 0, prompts_tightened: 0, tokens_saved: 0, weighted_savings: 0 };
}

function addEntry(s: PeriodStats, e: UsageEntry): void {
  if (e.tool === "analyze_prompt") s.prompts_analyzed++;
  if (e.tool === "tighten_prompt") s.prompts_tightened++;
  s.tokens_saved += e.tokens_saved ?? 0;
  s.weighted_savings += e.weighted_savings ?? 0;
}

function dateKey(ts: string): string {
  return ts.slice(0, 10); // "YYYY-MM-DD"
}

export function readTodaySavings(): number {
  const path = usagePath();
  if (!existsSync(path)) return 0;
  try {
    const start = todayStartMs();
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .reduce((sum, line) => {
        try {
          const e = JSON.parse(line) as UsageEntry;
          return new Date(e.ts).getTime() >= start ? sum + (e.tokens_saved ?? 0) : sum;
        } catch { return sum; }
      }, 0);
  } catch { return 0; }
}

export function readFullReport(): FullReport {
  const path = usagePath();
  const entries: UsageEntry[] = [];

  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line) as UsageEntry); } catch { /* skip */ }
    }
  }

  const now = Date.now();
  const todayStart = todayStartMs();
  const weekStart = todayStart - 6 * 86_400_000;
  const thirtyStart = todayStart - 29 * 86_400_000;

  const today = emptyStats(), week = emptyStats(), allTime = emptyStats();
  const byModel = { mini: 0, standard: 0, premium: 0 };
  const daily: Record<string, number> = {};

  for (const e of entries) {
    const t = new Date(e.ts).getTime();
    addEntry(allTime, e);
    if (t >= weekStart) addEntry(week, e);
    if (t >= todayStart) addEntry(today, e);
    const tier = e.model_suggestion as keyof typeof byModel;
    if (tier in byModel) byModel[tier] += e.weighted_savings ?? 0;
    if (t >= thirtyStart) {
      const k = dateKey(e.ts);
      daily[k] = (daily[k] ?? 0) + (e.tokens_saved ?? 0);
    }
  }

  void now; // suppress unused warning — kept for future TTL logic
  return { today, week, all_time: allTime, by_model: byModel, daily, log_path: path };
}
