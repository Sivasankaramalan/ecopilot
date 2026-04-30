/**
 * Token estimator — wraps gpt-tokenizer (cl100k_base / GPT-4 encoding).
 *
 * gpt-tokenizer is a pure-JS BPE implementation; no native code, no server
 * round-trips. Accurate to within ~2% of the OpenAI API token count.
 *
 * Fallback: if the import fails for any reason (e.g. very old Node),
 * we use the well-known heuristic: ceil(chars / 3.8).
 */

let encodeImpl: ((text: string) => number[]) | null = null;

async function getEncoder(): Promise<(text: string) => number[]> {
  if (encodeImpl) return encodeImpl;
  try {
    // Dynamic import so the module is tree-shaken when not used
    const mod = await import("gpt-tokenizer");
    encodeImpl = mod.encode;
    return encodeImpl;
  } catch {
    // Fallback
    encodeImpl = (text: string) => new Array(Math.ceil(text.length / 3.8)).fill(0);
    return encodeImpl;
  }
}

/**
 * Count the number of tokens in a string using the GPT-4 tokenizer.
 * Async on first call (lazy load), sync-like thereafter.
 */
export async function countTokens(text: string): Promise<number> {
  const encode = await getEncoder();
  return encode(text).length;
}

/**
 * Synchronous rough estimate: ceil(chars / 3.8).
 * Use when an exact count isn't critical.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}
