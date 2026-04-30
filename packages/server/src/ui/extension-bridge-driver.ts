/**
 * Extension bridge UI driver — delegates every dialog to the EcoPilot
 * VS Code extension over a local WebSocket, so prompts appear as native
 * VS Code QuickPick / InputBox / Webview panels.
 *
 * Falls back to the terminal driver if the extension disconnects.
 */

import { WebSocketServer, WebSocket } from "ws";
import type {
  UiDriver,
  AskUserOpts,
  ChooseOpts,
  MultilineOpts,
  ConfirmOpts,
  NotifyOpts,
} from "./driver.js";
import type { Logger } from "../logger.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ExtensionBridgeDriver implements UiDriver {
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private readonly fallback: UiDriver;
  private readonly pending = new Map<string, PendingRequest>();
  private msgId = 0;
  public port = 0;

  constructor(private readonly logger: Logger, requestedPort = 0, fallback: UiDriver) {
    this.fallback = fallback;
    this.wss = new WebSocketServer({ port: requestedPort, host: "127.0.0.1" });

    this.wss.once("listening", () => {
      const addr = this.wss!.address();
      this.port = typeof addr === "object" && addr !== null ? addr.port : requestedPort;
      this.writeRuntimeFile(this.port);
      this.logger.info(`Extension bridge WebSocket listening on 127.0.0.1:${this.port}`);
    });

    this.wss.on("connection", (ws) => {
      this.logger.info("VS Code extension connected to EcoPilot bridge");
      this.socket = ws;

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as { id: string; result: unknown };
          const pending = this.pending.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(msg.id);
            pending.resolve(msg.result);
          }
        } catch {
          this.logger.warn("Received unparseable message from extension bridge");
        }
      });

      ws.on("close", () => {
        this.logger.info("VS Code extension disconnected from EcoPilot bridge");
        this.socket = null;
        // Resolve any in-flight requests with null (will be treated as cancel)
        for (const [id, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.resolve(null);
          this.pending.delete(id);
        }
      });
    });

    this.wss.on("error", (err) => {
      this.logger.error(`Bridge WebSocket server error: ${err.message}`);
    });
  }

  private writeRuntimeFile(port: number): void {
    try {
      const dir = join(homedir(), ".ecopilot");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "runtime.json"), JSON.stringify({ port, pid: process.pid }));
    } catch (err) {
      this.logger.warn(`Could not write runtime.json: ${String(err)}`);
    }
  }

  private send<T>(type: string, payload: unknown, timeoutSecs: number): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Extension not connected — delegate to terminal fallback
      this.logger.debug(`Extension not connected, using terminal fallback for ${type}`);
      // This is the async path; caller will cast result
      return Promise.resolve(null as T);
    }

    const id = String(++this.msgId);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(null as T);
      }, timeoutSecs * 1000);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.socket!.send(JSON.stringify({ id, type, payload }));
    });
  }

  private isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  async askUser(opts: AskUserOpts): Promise<string | null> {
    if (!this.isConnected()) return this.fallback.askUser(opts);
    return this.send<string | null>("ask_user", opts, opts.timeoutSecs);
  }

  async chooseOne(opts: ChooseOpts): Promise<string | null> {
    if (!this.isConnected()) return this.fallback.chooseOne(opts);
    return this.send<string | null>("choose_one", opts, opts.timeoutSecs);
  }

  async chooseMany(opts: ChooseOpts): Promise<string[]> {
    if (!this.isConnected()) return this.fallback.chooseMany(opts);
    const result = await this.send<string[] | null>("choose_many", opts, opts.timeoutSecs);
    return result ?? [];
  }

  async multilineInput(opts: MultilineOpts): Promise<string | null> {
    if (!this.isConnected()) return this.fallback.multilineInput(opts);
    return this.send<string | null>("multiline_input", opts, opts.timeoutSecs);
  }

  async confirm(opts: ConfirmOpts): Promise<boolean | null> {
    if (!this.isConnected()) return this.fallback.confirm(opts);
    return this.send<boolean | null>("confirm", opts, opts.timeoutSecs);
  }

  notify(opts: NotifyOpts): void {
    if (!this.isConnected()) { this.fallback.notify(opts); return; }
    this.socket!.send(JSON.stringify({ id: "n", type: "notify", payload: opts }));
  }

  close(): void {
    this.wss?.close();
    this.socket?.close();
  }
}
