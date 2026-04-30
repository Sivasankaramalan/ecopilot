/**
 * dashboard.ts — EcoPilot savings dashboard Webview panel.
 *
 * Renders a single-page HTML dashboard (no external deps — all inline CSS + JS)
 * showing today/week/all-time savings, a bar chart of the last 30 days,
 * and a model-tier breakdown.
 */

import * as vscode from "vscode";
import { readFullReport, type FullReport } from "./savings.js";

let panel: vscode.WebviewPanel | undefined;

export function showDashboard(context: vscode.ExtensionContext): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    refresh();
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "ecopilotDashboard",
    "EcoPilot — Savings Dashboard",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);

  panel.webview.onDidReceiveMessage((msg: { command: string }) => {
    if (msg.command === "refresh") refresh();
  }, null, context.subscriptions);

  refresh();
}

function refresh(): void {
  if (!panel) return;
  const report = readFullReport();
  panel.webview.html = buildHtml(report);
}

// ── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(r: FullReport): string {
  // Build last-30-days bar chart data sorted by date
  const last30 = getLast30Days();
  const barValues = last30.map((d) => r.daily[d] ?? 0);
  const maxBar = Math.max(...barValues, 1);

  const bars = last30.map((date, i) => {
    const val = barValues[i] ?? 0;
    const pct = Math.round((val / maxBar) * 100);
    const label = date.slice(5); // "MM-DD"
    return `<div class="bar-wrap" title="${date}: ${val} tokens saved">
      <div class="bar" style="height:${pct}%"></div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join("");

  const tierRows = (["premium", "standard", "mini"] as const).map((tier) => {
    const v = Math.round(r.by_model[tier]);
    return `<tr><td>${tier}</td><td>${v.toLocaleString()}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EcoPilot Dashboard</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --card: var(--vscode-sideBar-background);
    --border: var(--vscode-panel-border);
    --accent: var(--vscode-button-background);
    --accent-fg: var(--vscode-button-foreground);
    --muted: var(--vscode-descriptionForeground);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family); font-size: 13px; padding: 24px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
  .subtitle { color: var(--muted); margin-bottom: 24px; font-size: 12px; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 8px; }
  .card-value { font-size: 28px; font-weight: 700; }
  .card-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 600; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  .chart { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding: 0 4px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; cursor: default; }
  .bar { width: 100%; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 2px; transition: opacity .2s; }
  .bar-wrap:hover .bar { opacity: .75; }
  .bar-label { font-size: 9px; color: var(--muted); margin-top: 3px; transform: rotate(-45deg); transform-origin: top left; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border); font-size: 12px; }
  th { color: var(--muted); font-weight: 500; }
  .btn { display: inline-block; margin-top: 16px; padding: 6px 14px; background: var(--accent); color: var(--accent-fg); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .btn:hover { opacity: .85; }
  .log-path { font-size: 11px; color: var(--muted); margin-top: 20px; font-family: var(--vscode-editor-font-family); word-break: break-all; }
</style>
</head>
<body>
<h1>⚡ EcoPilot Dashboard</h1>
<p class="subtitle">Local token savings — no data leaves your machine</p>

<div class="cards">
  <div class="card">
    <div class="card-title">Today</div>
    <div class="card-value">${r.today.tokens_saved.toLocaleString()}</div>
    <div class="card-sub">tokens saved · ${r.today.prompts_tightened} tightened</div>
  </div>
  <div class="card">
    <div class="card-title">This Week</div>
    <div class="card-value">${r.week.tokens_saved.toLocaleString()}</div>
    <div class="card-sub">tokens saved · ${r.week.prompts_analyzed} analyzed</div>
  </div>
  <div class="card">
    <div class="card-title">All Time</div>
    <div class="card-value">${r.all_time.tokens_saved.toLocaleString()}</div>
    <div class="card-sub">weighted: ${Math.round(r.all_time.weighted_savings).toLocaleString()} premium-eq.</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Last 30 Days — Tokens Saved</div>
  <div class="chart">${bars}</div>
</div>

<div class="section">
  <div class="section-title">Weighted Savings by Model Tier</div>
  <table>
    <thead><tr><th>Tier</th><th>Weighted tokens saved</th></tr></thead>
    <tbody>${tierRows}</tbody>
  </table>
</div>

<button class="btn" onclick="refresh()">↻ Refresh</button>
<div class="log-path">Log: ${r.log_path}</div>

<script>
  const vscode = acquireVsCodeApi();
  function refresh() { vscode.postMessage({ command: 'refresh' }); }
</script>
</body>
</html>`;
}

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
