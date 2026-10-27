// src/ai/commitMessage.ts
// Pure module that turns a diff into Lite-Model chat messages (Conventional Commits style)
// and sanitizes the model's raw reply into a clean single commit message.
// No vscode import. No fetch. Deterministic pure functions.
// Spec: docs/AI_HANDOFF/tasks/TASK-GC-003.md (GC-003), frozen system text per PLAN.md.

import type { ChatMessage } from "./provider";

// ---- constants --------------------------------------------------------------
export const COMMIT_SUBJECT_MAX_CHARS = 72;

// ---- frozen system prompt (owner contract, 2026-10-27) -----------------------
const SYSTEM_PROMPT =
  "You generate ONE git commit message subject line. Reply with ONLY that single line: no body, no explanation, no code fences, no quotes, no alternatives, no reasoning. Prefer Vietnamese (tiếng Việt). Start with a Conventional Commits type prefix (feat, fix, refactor, chore, docs, test, ...) when it fits. Target 8–16 words, max 72 characters. Example: feat(db): thêm chỉ mục cho bảng users";

// ---- types -----------------------------------------------------------------
export interface CommitPromptInput {
  repoName: string;
  branch?: string;
  files: readonly string[];
  diffText: string;
}

// ---- buildCommitPrompt -----------------------------------------------------
export function buildCommitPrompt(input: CommitPromptInput): ChatMessage[] {
  const fileList =
    input.files.length > 0 ? input.files.map((f) => `- ${f}`).join("\n") : "- (none)";
  const branchLine = input.branch ? `Branch: ${input.branch}\n` : "";
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
  return out.slice(0, COMMIT_SUBJECT_MAX_CHARS);
}