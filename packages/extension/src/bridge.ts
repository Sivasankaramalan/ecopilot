/**
 * bridge.ts — WebSocket client that connects to the EcoPilot MCP server bridge.
 *
 * Reads ~/.ecopilot/runtime.json to discover the port, connects, and
 * dispatches incoming messages to the VS Code UI handlers.
 * Reconnects with exponential back-off (1 → 2 → 4 → … → 30 s).
 */

import * as vscode from "vscode";
import WebSocket from "ws";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  handleAskUser,
  handleChooseOne,
  handleChooseMany,
  handleConfirm,
  handleNotify,
} from "./handlers.js";
import { showMultilineWebview } from "./webview-multiline.js";

type ConnectionState = "connected" | "disconnected" | "connecting";

interface RuntimeFile {
  port: number;
  pid: number;
}

interface BridgeMessage {
  id: string;
  type: string;
  payload: unknown;
}

export type OnStateChange = (state: ConnectionState) => void;

const RUNTIME_FILE = join(
  process.env["ECOPILOT_DATA_DIR"] ?? join(homedir(), ".ecopilot"),
  "runtime.json",
);
const BACKOFF_STEPS = [1000, 2000, 4000, 8000, 16000, 30000];

export class EcoPilotBridge {
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly onStateChange: OnStateChange;
  private readonly context: vscode.ExtensionContext;

  constructor(onStateChange: OnStateChange, context: vscode.ExtensionContext) {
    this.onStateChange = onStateChange;
    this.context = context;
  }

  connect(): void {
    if (this.destroyed) return;

    const port = this.readPort();
    if (port === null) {
      this.scheduleRetry();
      return;
    }

    this.onStateChange("connecting");
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws = ws;

    ws.on("open", () => {
      this.retryCount = 0;
      this.onStateChange("connected");
    });

    ws.on("message", (raw) => {
      void this.dispatch(raw.toString());
    });

    ws.on("close", () => {
      this.ws = null;
      if (!this.destroyed) {
        this.onStateChange("disconnected");
        this.scheduleRetry();
      }
    });

    ws.on("error", () => {
      // close event fires after error — handled there
    });
  }

  private readPort(): number | null {
    if (!existsSync(RUNTIME_FILE)) return null;
    try {
      const data = JSON.parse(readFileSync(RUNTIME_FILE, "utf8")) as RuntimeFile;
      return typeof data.port === "number" ? data.port : null;
    } catch {
      return null;
    }
  }

  private scheduleRetry(): void {
    if (this.destroyed) return;
    const delay = BACKOFF_STEPS[Math.min(this.retryCount, BACKOFF_STEPS.length - 1)] ?? 30000;
    this.retryCount++;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private async dispatch(raw: string): Promise<void> {
    let msg: BridgeMessage;
    try {
      msg = JSON.parse(raw) as BridgeMessage;
    } catch {
      return;
    }

    let result: unknown = null;

    try {
      switch (msg.type) {
        case "ask_user":
          result = await handleAskUser(msg.payload as Parameters<typeof handleAskUser>[0]);
          break;
        case "choose_one":
          result = await handleChooseOne(msg.payload as Parameters<typeof handleChooseOne>[0]);
          break;
        case "choose_many":
          result = await handleChooseMany(msg.payload as Parameters<typeof handleChooseMany>[0]);
          break;
        case "multiline_input":
          result = await showMultilineWebview(this.context, {
            id: msg.id,
            ...(msg.payload as { title: string; prompt: string; defaultValue?: string; timeoutSecs: number }),
          });
          break;
        case "confirm":
          result = await handleConfirm(msg.payload as Parameters<typeof handleConfirm>[0]);
          break;
        case "notify":
          handleNotify(msg.payload as Parameters<typeof handleNotify>[0]);
          return; // fire-and-forget — no reply needed
        default:
          vscode.window.showWarningMessage(`EcoPilot: unknown message type '${msg.type}'`);
          return;
      }
    } catch (err) {
      // Reply with null so the server doesn't hang
      result = null;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ id: msg.id, result }));
    }
  }

  dispose(): void {
    this.destroyed = true;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
  }
}
