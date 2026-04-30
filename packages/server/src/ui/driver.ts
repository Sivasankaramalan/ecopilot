/**
 * UI driver interface — every dialog surface implements this so the
 * MCP tools remain agnostic of whether they're running under the VS Code
 * extension WebSocket bridge or a plain terminal fallback.
 */

export interface UiDriver {
  /** Ask for single-line input; returns null if cancelled / timed-out. */
  askUser(opts: AskUserOpts): Promise<string | null>;

  /** Present a single-select list; returns null if cancelled / timed-out. */
  chooseOne(opts: ChooseOpts): Promise<string | null>;

  /** Present a multi-select list; returns [] if cancelled / timed-out. */
  chooseMany(opts: ChooseOpts): Promise<string[]>;

  /** Ask for multi-line text; returns null if cancelled / timed-out. */
  multilineInput(opts: MultilineOpts): Promise<string | null>;

  /** Ask yes/no; returns null if cancelled / timed-out. */
  confirm(opts: ConfirmOpts): Promise<boolean | null>;

  /** Fire-and-forget notification. */
  notify(opts: NotifyOpts): void;
}

export interface AskUserOpts {
  title: string;
  prompt: string;
  defaultValue?: string;
  inputType?: "text" | "integer" | "float";
  timeoutSecs: number;
}

export interface ChooseOpts {
  title: string;
  prompt: string;
  choices: string[];
  timeoutSecs: number;
}

export interface MultilineOpts {
  title: string;
  prompt: string;
  defaultValue?: string;
  timeoutSecs: number;
}

export interface ConfirmOpts {
  title: string;
  message: string;
  timeoutSecs: number;
}

export interface NotifyOpts {
  title: string;
  message: string;
}
