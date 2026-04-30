/**
 * extension.ts — VS Code extension entry point.
 *
 * On activation: starts the bridge client and status bar.
 * Registers two commands: reconnect and showSavings.
 */

import * as vscode from "vscode";
import { EcoPilotBridge } from "./bridge.js";
import { EcoPilotStatusBar } from "./status-bar.js";
import { showDashboard } from "./dashboard.js";

let bridge: EcoPilotBridge | undefined;
let statusBar: EcoPilotStatusBar | undefined;

export function activate(context: vscode.ExtensionContext): void {
  statusBar = new EcoPilotStatusBar(context);

  bridge = new EcoPilotBridge((state) => {
    statusBar?.setState(state);
  }, context);
  bridge.connect();

  context.subscriptions.push(
    vscode.commands.registerCommand("ecopilot.reconnect", () => {
      bridge?.dispose();
      bridge = new EcoPilotBridge((state) => statusBar?.setState(state), context);
      bridge.connect();
      vscode.window.showInformationMessage("EcoPilot: reconnecting to MCP server…");
    }),

    vscode.commands.registerCommand("ecopilot.showDashboard", () => {
      showDashboard(context);
    }),

    { dispose: () => { bridge?.dispose(); statusBar?.dispose(); } },
  );
}

export function deactivate(): void {
  bridge?.dispose();
  statusBar?.dispose();
}
