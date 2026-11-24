// src/ai/commitMessage.ts
// Pure module that turns a diff into Lite-Model chat messages (Conventional Commits style)
// and sanitizes the model's raw reply into a clean single commit message.
// No vscode import. No fetch. Deterministic pure functions.
// Spec: docs/AI_HANDOFF/tasks/TASK-GC-003.md (GC-003), frozen system text per PLAN.md.

import type { ChatMessage } from "./provider";

// ---- constants --------------------------------------------------------------
/** Hard safety cap. The model is asked for ≤100 chars; cutting only happens
 *  past this cap and always at a word boundary (never mid-word). */
export const COMMIT_SUBJECT_MAX_CHARS = 150;
/** Fallback (file-name) subjects stay short. */
export const COMMIT_FALLBACK_MAX_CHARS = 72;

// ---- frozen system prompt (owner contract, 2026-10-27) -----------------------
const SYSTEM_PROMPT =
  "You generate ONE git commit message subject line. Reply with ONLY that single line: no body, no explanation, no code fences, no quotes, no alternatives, no reasoning. Write in Vietnamese (tiếng Việt) only — never French or other languages; keep code identifiers as-is. Start with a Conventional Commits type prefix (feat, fix, refactor, chore, docs, test, ...) when it fits. Write ONE complete, meaningful sentence that says what changed and why it matters: 10–20 words, about 60–100 characters. Never stop mid-word or mid-phrase. Example: fix(credit): chuẩn hóa đường dẫn hạn mức tín dụng và cập nhật quyền truy cập API";

// ---- types -----------------------------------------------------------------
export interface CommitPromptInput {
  repoName: string;
  branch?: string;
  files: readonly string[];
  diffText: string;
  /** "files" ⇒ diffText is already a file-list summary (large change set). */
  mode?: "diff" | "files";
}

// ---- buildCommitPrompt -----------------------------------------------------
export function buildCommitPrompt(input: CommitPromptInput): ChatMessage[] {
  const branchLine = input.branch ? `Branch: ${input.branch}\n` : "";
  if (input.mode === "files") {
    return [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Repo: ${input.repoName}\n${branchLine}${input.diffText}` },
    ];
  }
  const fileList =
    input.files.length > 0 ? input.files.map((f) => `- ${f}`).join("\n") : "- (none)";
  const userContent =
    `Repo: ${input.repoName}\n` +
    branchLine +
    `Changed files:\n${fileList}\n` +
    `Diff:\n${input.diffText}`;
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}

/**
 * Render the commit chat messages as plain text for engines whose ACP prompt
 * accepts one string rather than a ChatMessage array. The role labels keep the
 * commit-only instruction and repository context distinct.
 *
 * Throws a structured Error if a `ChatContentPart` carries a non-string
 * `text`/`imageUrl` or a `ChatMessage.content` is neither a string nor an
 * array. Letting either case reach the template literal would silently
 * stringify the object and emit `[object Object]` into the commit prompt.
 * Pure commit prompts always carry plain string content, so the throw is a
 * defence-in-depth check, not a hot path.
 */
export function serializeCommitPrompt(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => {
      let content: string;
      if (typeof message.content === "string") {
        content = message.content;
      } else if (Array.isArray(message.content)) {
        content = message.content
          .map((part, index) => {
            const text = part.text;
            const imageUrl = part.imageUrl;
            if (typeof text === "string") return text;
            if (typeof imageUrl === "string") return imageUrl;
            throw new Error(
              `commit-gen: ChatContentPart[${index}].text/imageUrl must be a string`,
            );
          })
          .join("");
      } else {
        throw new Error(
          "commit-gen: ChatMessage.content must be string or string-part array",
        );
      }
      return `${message.role.toUpperCase()}:
${content}`;
    })
    .join("\n\n");
}

// ---- buildFallbackCommitMessage ---------------------------------------------
/** Paths named by `diff --git a/x b/y` headers or `<status> <path>` summary rows. */
export function extractChangedPaths(diffText: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (p: string) => {
    const path = p.trim();
    if (path && path !== "/dev/null" && !seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  };
  for (const m of diffText.matchAll(/^diff --git a\/(\S+)(?: b\/(\S+))?/gm)) add(m[2] ?? m[1]);
  if (out.length === 0) {
    for (const m of diffText.matchAll(/^[AMDRCT] (\S.*)$/gm)) add(m[1]);
  }
  return out;
}

function baseName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/**
 * Instant, model-free commit subject built from changed file names. Used when
 * the model is slow, fails, or returns unusable text — speed beats quality.
 */
export function buildFallbackCommitMessage(files: readonly string[]): string {
  const unique = [...new Set(files.filter((f) => typeof f === "string" && f.trim() !== ""))];
  if (unique.length === 0) return "chore: cập nhật mã nguồn";
  const isDoc = (f: string) => /\.(?:md|mdx|rst|txt)$/i.test(f) || /(?:^|\/)docs\//i.test(f);
  const isTest = (f: string) => /(?:^|\/)(?:__tests__|tests?)\/|\.(?:test|spec)\.[a-z0-9]+$/i.test(f);
  const type = unique.every(isDoc) ? "docs" : unique.every(isTest) ? "test" : "chore";
  const names = [...new Set(unique.map(baseName))];
  const prefix = `${type}: cập nhật `;
  let shown = names.slice(0, 3);
  const build = (list: string[]) => {
    const rest = unique.length - list.length;
    return prefix + list.join(", ") + (rest > 0 ? ` và ${rest} file khác` : "");
  };
  let message = build(shown);
  while (message.length > COMMIT_FALLBACK_MAX_CHARS && shown.length > 1) {
    shown = shown.slice(0, -1);
    message = build(shown);
  }
  return clampAtWord(message, COMMIT_FALLBACK_MAX_CHARS);
}

// ---- sanitizeCommitMessage -------------------------------------------------
/** Normalize a model reply into the first short subject line only. */
export function sanitizeCommitMessage(raw: string): string {
  let out = raw.trim();
  if (out.length === 0) return "";

  const fenceMatch = out.match(/^```[^\n`]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) out = fenceMatch[1].trim();

  if (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) ||
      (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1).trim();
  }

  out = out.split(/\r?\n/).find((line) => line.trim() !== "")?.trim() ?? "";
  if (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) ||
      (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1).trim();
  }
  out = out.replace(/^(?:- |\* |#+\s*)+/, "").trim();
  out = out.replace(/^(?:- |\* |#+\s*)+/, "").trim();
  if (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) ||
      (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1).trim();
  }
  // Drop trailing stray tokens in non-Latin scripts (model glitches such as
  // "… ngân sách byte ગુજરાતી"); Vietnamese is Latin script and is kept.
  out = out.replace(/(?:\s+\S*[^\s\p{Script=Latin}\p{N}\p{P}\p{S}\p{M}]\S*)+$/u, "").trim();
  return clampAtWord(out, COMMIT_SUBJECT_MAX_CHARS);
}

// Vietnamese/English connectors that must not end a subject after a cut.
const DANGLING_TAIL_RE =
  /(?:[\s,;:–-]+(?:và|cho|của|với|để|các|những|trong|khi|từ|đến|tới|theo|hoặc|nhưng|là|một|and|or|for|of|to|with|in|on|the|a|an|by|from))+[\s,;:–-]*$/iu;

/**
 * Shorten `text` to at most `max` characters without ever splitting a word,
 * then drop trailing connectors/punctuation so the subject still reads as a
 * complete phrase. A single over-long token is the only case cut mid-token.
 */
export function clampAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  const lastSpace = head.lastIndexOf(" ");
  let out = lastSpace > 0 ? head.slice(0, lastSpace) : text.slice(0, max);
  out = out.replace(/[\s,;:–-]+$/u, "");
  for (let i = 0; i < 4 && DANGLING_TAIL_RE.test(out); i++) {
    const trimmed = out.replace(DANGLING_TAIL_RE, "");
    if (trimmed.length === 0 || trimmed === out) break;
    out = trimmed;
  }
  return out.trim();
}