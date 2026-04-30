/**
 * handlers.ts — maps incoming bridge message types to native VS Code UI calls.
 *
 * Each handler receives the payload from the server and returns the result
 * to be sent back as { id, result }.
 */

import * as vscode from "vscode";

export interface AskUserPayload {
  title: string;
  prompt: string;
  defaultValue?: string;
  inputType?: "text" | "integer" | "float";
  timeoutSecs: number;
}

export interface ChoosePayload {
  title: string;
  prompt: string;
  choices: string[];
  timeoutSecs: number;
}

export interface MultilinePayload {
  title: string;
  prompt: string;
  defaultValue?: string;
  timeoutSecs: number;
}

export interface ConfirmPayload {
  title: string;
  message: string;
  timeoutSecs: number;
}

export interface NotifyPayload {
  title: string;
  message: string;
}

export async function handleAskUser(p: AskUserPayload): Promise<string | null> {
  const validate =
    p.inputType === "integer"
      ? (v: string): string | null => (/^-?\d+$/.test(v.trim()) ? null : "Enter a whole number")
      : p.inputType === "float"
        ? (v: string): string | null => (/^-?\d+(\.\d+)?$/.test(v.trim()) ? null : "Enter a number")
        : undefined;

  const result = await vscode.window.showInputBox({
    title: p.title,
    prompt: p.prompt,
    value: p.defaultValue ?? "",
    ignoreFocusOut: true,
    ...(validate !== undefined && { validateInput: validate }),
  });
  return result ?? null;
}

export async function handleChooseOne(p: ChoosePayload): Promise<string | null> {
  const result = await vscode.window.showQuickPick(p.choices, {
    title: p.title,
    placeHolder: p.prompt,
    canPickMany: false,
    ignoreFocusOut: true,
  });
  return result ?? null;
}

export async function handleChooseMany(p: ChoosePayload): Promise<string[] | null> {
  const result = await vscode.window.showQuickPick(p.choices, {
    title: p.title,
    placeHolder: p.prompt,
    canPickMany: true,
    ignoreFocusOut: true,
  });
  return result ?? null;
}

export async function handleMultilineInput(p: MultilinePayload): Promise<string | null> {
  // VS Code InputBox doesn't support multiline typing, but accepts pasted content.
  const result = await vscode.window.showInputBox({
    title: p.title,
    prompt: p.prompt + "  (tip: paste multi-line text)",
    value: p.defaultValue ?? "",
    ignoreFocusOut: true,
  });
  return result ?? null;
}

export async function handleConfirm(p: ConfirmPayload): Promise<boolean | null> {
  const answer = await vscode.window.showInformationMessage(
    `${p.title}\n\n${p.message}`,
    { modal: true },
    "Yes",
    "No",
  );
  if (answer === undefined) return null;
  return answer === "Yes";
}

export function handleNotify(p: NotifyPayload): void {
  void vscode.window.showInformationMessage(`${p.title}: ${p.message}`);
}
