/**
 * status-bar.ts — shows connection state and today's token savings.
 */

import * as vscode from "vscode";
import { readTodaySavings } from "./savings.js";

export class EcoPilotStatusBar {
  private readonly item: vscode.StatusBarItem;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: "connected" | "disconnected" | "connecting" = "disconnected";

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "ecopilot.showDashboard";
    this.item.tooltip = "EcoPilot — click to view savings report";
    context.subscriptions.push(this.item);
    this.item.show();
    this.render();

    // Refresh savings count every 30 s
    this.timer = setInterval(() => this.render(), 30_000);
  }

  setState(state: "connected" | "disconnected" | "connecting"): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    const saved = readTodaySavings();
    const savingsText = saved > 0 ? ` · ${saved} tokens saved today` : "";

    switch (this.state) {
      case "connected":
        this.item.text = `$(circuit-board) EcoPilot: connected${savingsText}`;
        this.item.backgroundColor = undefined;
        this.item.color = new vscode.ThemeColor("statusBarItem.prominentForeground");
        break;
      case "connecting":
        this.item.text = "$(sync~spin) EcoPilot: connecting…";
        this.item.backgroundColor = undefined;
        this.item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
        break;
      case "disconnected":
        this.item.text = `$(circle-slash) EcoPilot: disconnected${savingsText}`;
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        this.item.color = undefined;
        break;
    }
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.item.dispose();
  }
}
