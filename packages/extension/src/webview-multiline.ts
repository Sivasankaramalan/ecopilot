/**
 * webview-multiline.ts — Monaco-powered multiline input Webview.
 *
 * The MCP server's multiline_input tool opens this panel. The user types
 * (or pastes) into a full Monaco editor; Submit sends the text back to the
 * bridge; Cancel returns null.
 *
 * Monaco is loaded from the VS Code built-in CDN path so no extra npm dep needed.
 */

import * as vscode from "vscode";

export interface MultilineRequest {
  id: string;
  title: string;
  prompt: string;
  defaultValue?: string;
  timeoutSecs: number;
}

export async function showMultilineWebview(
  context: vscode.ExtensionContext,
  req: MultilineRequest,
): Promise<string | null> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      "ecopilotMultiline",
      req.title,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: false },
    );

    // Auto-cancel on timeout
    const timer = setTimeout(() => {
      resolve(null);
      panel.dispose();
    }, req.timeoutSecs * 1000);

    panel.onDidDispose(() => {
      clearTimeout(timer);
      resolve(null);
    }, null, context.subscriptions);

    panel.webview.onDidReceiveMessage(
      (msg: { command: "submit" | "cancel"; text?: string }) => {
        clearTimeout(timer);
        panel.dispose();
        resolve(msg.command === "submit" ? (msg.text ?? "") : null);
      },
      null,
      context.subscriptions,
    );

    panel.webview.html = buildHtml(req);
  });
}

function buildHtml(req: MultilineRequest): string {
  const escaped = (req.defaultValue ?? "").replace(/`/g, "\\`");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border);
    --accent: var(--vscode-button-background);
    --accent-fg: var(--vscode-button-foreground);
    --muted: var(--vscode-descriptionForeground);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family); font-size: 13px; }
  .layout { display: flex; flex-direction: column; height: 100vh; padding: 16px; gap: 12px; }
  .prompt { color: var(--muted); font-size: 12px; flex-shrink: 0; }
  #editor { flex: 1; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; min-height: 200px; }
  .actions { display: flex; gap: 8px; flex-shrink: 0; }
  button { padding: 6px 18px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
  .submit { background: var(--accent); color: var(--accent-fg); }
  .cancel { background: var(--vscode-button-secondaryBackground, #3c3c3c); color: var(--vscode-button-secondaryForeground, #ccc); }
  button:hover { opacity: .85; }
</style>
</head>
<body>
<div class="layout">
  <div class="prompt">${escapeHtml(req.prompt)}</div>
  <div id="editor"></div>
  <div class="actions">
    <button class="submit" onclick="submit()">Submit</button>
    <button class="cancel" onclick="cancel()">Cancel</button>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs/loader.js"></script>
<script>
  const vscode = acquireVsCodeApi();
  let editor;

  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs' } });
  require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('editor'), {
      value: \`${escaped}\`,
      language: 'plaintext',
      theme: document.body.classList.contains('vscode-light') ? 'vs' : 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: 'on',
      lineNumbers: 'off',
      scrollBeyondLastLine: false,
      fontSize: 13,
    });
    editor.focus();
    // Ctrl+Enter submits
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submit());
  });

  function submit() {
    vscode.postMessage({ command: 'submit', text: editor ? editor.getValue() : '' });
  }
  function cancel() {
    vscode.postMessage({ command: 'cancel' });
  }
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
