// src/ai/commitMessageGuard.ts
// Single-call commit generation: reject only empty output and clearly non-message garbage.
// Zero imports, deterministic, editor-runtime free — safe to unit test.

export type CommitMessageIssue =
  | "empty"
  | "unbroken-blob"
  | "hash-like"
  | "symbol-heavy"
  | "reasoning-marker";

export interface CommitMessageGuardResult {
  ok: boolean;
  reasons: readonly CommitMessageIssue[];
}

export const GUARD_BLOB_TOKEN_MIN_CHARS = 40;
export const GUARD_SYMBOL_RATIO_MAX = 0.5;

/** Hex-shaped blob. */
const HASH_LIKE_RE = /^[0-9a-f]{32,}$/i;

/** Unicode letter-or-digit. */
const LETTER_OR_DIGIT_RE = /\p{L}|\p{N}/u;

/** Repeated-interjection signal. */
const INTERJECTION_RE = /\b(okay|wait)\b/gi;

/** Reasoning line-openers. */
const REASONING_LINE_OPENERS: readonly string[] = [
  "we need to",
  "let me",
  "the user",
  "first,",
  "okay,",
  "wait,",
  "step 1",
  "step 2",
  "i will",
  "i'll",
  "here is",
  "here's",
];

/** Whole-text reasoning phrases. */
const REASONING_PHRASES: readonly string[] = ["thinking process", "chain of thought"];

function hasUnbrokenBlob(tokens: readonly string[]): boolean {
  return tokens.some((token) => token.length >= GUARD_BLOB_TOKEN_MIN_CHARS);
}

function hasHashLike(tokens: readonly string[]): boolean {
  return tokens.some((token) => HASH_LIKE_RE.test(token));
}

function isSymbolHeavy(candidate: string): boolean {
  const nonWhitespace = candidate.replace(/\s+/g, "");
  if (nonWhitespace.length === 0) return false;
  let symbolCount = 0;
  for (const character of nonWhitespace) {
    if (!LETTER_OR_DIGIT_RE.test(character)) symbolCount += 1;
  }
  return symbolCount / nonWhitespace.length > GUARD_SYMBOL_RATIO_MAX;
}

function hasReasoningMarker(candidate: string): boolean {
  if (candidate.includes("```")) return true;

  for (const line of candidate.split("\n")) {
    const start = line.trimStart().toLowerCase();
    if (start === "") continue;
    for (const opener of REASONING_LINE_OPENERS) {
      if (start.startsWith(opener)) return true;
    }
  }

  const lowered = candidate.toLowerCase();
  for (const phrase of REASONING_PHRASES) {
    if (lowered.includes(phrase)) return true;
  }

  const interjections = candidate.match(INTERJECTION_RE);
  return interjections !== null && interjections.length >= 2;
}

/** Reject only empty output and clearly non-commit-message content. */
export function checkCommitMessage(candidate: string): CommitMessageGuardResult {
  if (candidate.trim() === "") {
    return { ok: false, reasons: ["empty"] };
  }

  const tokens = candidate.trim().split(/\s+/);
  const reasons: CommitMessageIssue[] = [];
  if (hasUnbrokenBlob(tokens)) reasons.push("unbroken-blob");
  if (hasHashLike(tokens)) reasons.push("hash-like");
  if (isSymbolHeavy(candidate)) reasons.push("symbol-heavy");
  if (hasReasoningMarker(candidate)) reasons.push("reasoning-marker");
  return { ok: reasons.length === 0, reasons };
}
