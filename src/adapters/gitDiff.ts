// src/adapters/gitDiff.ts
//
// TASK-GC-002 — git diff source adapter (vscode.git extension API).
//
// Pure/structural everywhere except `getGitApi()`, which is the only function
// that imports the real `vscode` module. Consumers (GC-007) compose this with
// `pickRepository()` + `collectCommitDiff()` + `repo.inputBox.value` to drive
// the "Generate Commit Message" SCM sparkle.
//
// Owner contract (2026-10-27): 4 KiB byte budget, bounded file/path lists, generated hunks omitted when source exists.
import { createHash } from "node:crypto";
import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Structural types — real vscode.git `Repository` instances satisfy these
// without any `any`. We deliberately avoid importing the real `vscode.git`
// d.ts so unit tests can construct fakes cheaply.
// ---------------------------------------------------------------------------

export interface GitUriLike {
  fsPath: string;
}

export interface GitChangeLike {
  uri: GitUriLike;
  /** vscode.git `Status` enum value (optional — fakes may omit it). */
  status?: number;
}

export interface GitRepositoryLike {
  rootUri: GitUriLike;
  /** `diff(true)` = staged (index vs HEAD); `diff()` = unstaged (working tree vs index). */
  diff(cached?: boolean): Promise<string>;
  state: {
    HEAD?: { name?: string };
    indexChanges: readonly GitChangeLike[];
    workingTreeChanges: readonly GitChangeLike[];
    mergeChanges?: readonly GitChangeLike[];
  };
  inputBox: { value: string };
}

export interface GitApiLike {
  repositories: readonly GitRepositoryLike[];
}

export interface CommitDiffInput {
  repoName: string;
  branch?: string;
  files: string[];
  diffText: string;
  scope: "staged" | "unstaged";
  diffFingerprint: string;
  /** "files" ⇒ large change set: only file names/status were sent (no diff read). */
  mode?: "diff" | "files";
}
export type GitDiffTraceValue = string | number | boolean;
export type GitDiffTrace = (
  event: string,
  metadata: Readonly<Record<string, GitDiffTraceValue>>,
) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 2–4 KiB owner budget, measured in UTF-8 bytes (not tokens). */
export const GIT_DIFF_MAX_BYTES = 4_096;
export const MAX_COMMIT_FILES = 40;
export const MAX_COMMIT_PATH_CHARS = 100;
/** Above this many changed files the diff is never read: file names + status only (speed). */
export const FILE_LIST_MODE_THRESHOLD = 20;
/** Raw diff text beyond this is cut before budgeting so huge diffs stay O(cap). */
export const RAW_DIFF_SCAN_MAX_CHARS = 256 * 1024;

const SUMMARY_HEADER = "Changed files:\n";
const SUMMARY_MAX_BYTES = Math.floor(GIT_DIFF_MAX_BYTES / 3);

function diffFilePath(section: string): string {
  const header = section.match(/^diff --git a\/(.*?) b\/(.*?)$/m);
  return header ? (header[2] === "/dev/null" ? header[1] : header[2]) : "(unclassified diff)";
}

function fileClass(path: string): "source" | "docs/config" | "generated" {
  if (/(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|Gemfile\.lock|composer\.lock)$|(?:\.min\.(?:js|css)$|(?:^|\/)(?:dist|build|generated)\/)/i.test(path)) return "generated";
  if (/\.(?:md|mdx|rst|txt|ya?ml|toml|json|ini|cfg|conf)$/i.test(path) || /(?:^|\/)(?:\.github|\.vscode)\//.test(path)) return "docs/config";
  return "source";
}

function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function takeUtf8Prefix(text: string, maxBytes: number): string {
  let end = 0;
  let usedBytes = 0;
  for (const character of text) {
    const characterBytes = utf8Bytes(character);
    if (usedBytes + characterBytes > maxBytes) break;
    usedBytes += characterBytes;
    end += character.length;
  }
  return text.slice(0, end);
}

/** Return the longest prefix ending at a complete line and fitting the byte limit. */
function takeCompleteLines(text: string, maxBytes: number, totalBytes: number): string {
  if (totalBytes <= maxBytes) return text;
  let lineStart = 0;
  let end = 0;
  let usedBytes = 0;
  while (lineStart < text.length) {
    const newline = text.indexOf("\n", lineStart);
    const lineEnd = newline < 0 ? text.length : newline + 1;
    const lineBytes = utf8Bytes(text.slice(lineStart, lineEnd));
    if (usedBytes + lineBytes > maxBytes) break;
    usedBytes += lineBytes;
    end = lineEnd;
    lineStart = lineEnd;
  }
  return text.slice(0, end);
}

function summaryRow(section: string, path: string, generatedOmitted = false): string {
  const hunkStart = section.search(/^@@ /m);
  const header = hunkStart < 0 ? section : section.slice(0, hunkStart);
  const status = header.match(/^(?:rename from|rename to|deleted file mode|new file mode|Binary files|GIT binary patch).*$/gm) ?? [];
  const details = [...status, ...(generatedOmitted ? ["generated — content omitted"] : [])];
  return `- ${path}${details.length ? ` (${details.join("; ")})` : ""}`;
}

function fileSummary(sections: string[], paths: string[], omitGenerated = false): string {
  const rows = sections.map((section, index) => summaryRow(
    section,
    paths[index],
    omitGenerated && fileClass(paths[index]) === "generated",
  ));
  const included: string[] = [];
  let usedBytes = utf8Bytes(SUMMARY_HEADER);
  let omitted = 0;
  for (const row of rows) {
    const rowBytes = utf8Bytes(`${row}\n`);
    if (usedBytes + rowBytes <= SUMMARY_MAX_BYTES) {
      included.push(row);
      usedBytes += rowBytes;
    } else {
      omitted++;
    }
  }
  if (omitted) {
    let marker = `… [${omitted} additional changed file(s) omitted from summary]\n`;
    while (included.length && usedBytes + utf8Bytes(marker) + 1 > SUMMARY_MAX_BYTES) {
      const removed = included.pop()!;
      usedBytes -= utf8Bytes(`${removed}\n`);
      omitted++;
      marker = `… [${omitted} additional changed file(s) omitted from summary]\n`;
    }
    return `${SUMMARY_HEADER}${included.join("\n")}${included.length ? "\n" : ""}${marker}\n`;
  }
  return `${SUMMARY_HEADER}${included.join("\n")}\n\n`;
}

function boundedDiff(text: string): string {
  if (utf8Bytes(text) <= GIT_DIFF_MAX_BYTES) return text;
  const sections = text.split(/(?=^diff --git )/m).filter(Boolean);
  if (!sections.length) {
    const marker = "\n… [diff truncated]";
    return takeUtf8Prefix(text, GIT_DIFF_MAX_BYTES - utf8Bytes(marker)) + marker;
  }

  const paths = sections.map(diffFilePath);
  const omitGenerated = paths.some((path) => fileClass(path) === "source");
  const summary = fileSummary(sections, paths, omitGenerated);
  const truncationMarker = (count: number) => `\n… [partial diff; ${count} file(s) truncated]`;
  const markerReserve = utf8Bytes(truncationMarker(sections.length));
  const bodyBudget = Math.max(0, GIT_DIFF_MAX_BYTES - utf8Bytes(summary) - markerReserve);
  const sectionBytes = sections.map(utf8Bytes);
  const body = new Array<string>(sections.length).fill("");
  const bodyBytes = new Array<number>(sections.length).fill(0);
  let remaining = bodyBudget;
  let active = sections.map((_, index) => index).filter((index) =>
    !(omitGenerated && fileClass(paths[index]) === "generated"),
  );
  if (omitGenerated) {
    sections.forEach((_, index) => {
      if (fileClass(paths[index]) === "generated") bodyBytes[index] = sectionBytes[index];
    });
  }

  while (remaining > 0 && active.length) {
    const totalWeight = active.reduce((sum, index) => sum + (fileClass(paths[index]) === "source" ? 3 : 1), 0);
    const shares = active.map((index) => Math.floor(remaining * (fileClass(paths[index]) === "source" ? 3 : 1) / totalWeight));
    let assigned = shares.reduce((sum, share) => sum + share, 0);
    for (let index = 0; assigned < remaining; index++, assigned++) shares[index]++;

    let consumed = 0;
    const next: number[] = [];
    for (let activeIndex = 0; activeIndex < active.length; activeIndex++) {
      const index = active[activeIndex];
      const candidate = takeCompleteLines(sections[index], bodyBytes[index] + shares[activeIndex], sectionBytes[index]);
      const candidateBytes = utf8Bytes(candidate);
      if (candidateBytes > bodyBytes[index]) {
        body[index] = candidate;
        consumed += candidateBytes - bodyBytes[index];
        bodyBytes[index] = candidateBytes;
      }
      if (bodyBytes[index] < sectionBytes[index]) next.push(index);
    }

    if (!consumed) {
      let bestIndex = -1;
      let bestPrefix = "";
      let bestBytes = 0;
      for (const index of active) {
        const candidate = takeCompleteLines(sections[index], bodyBytes[index] + remaining, sectionBytes[index]);
        const candidateBytes = utf8Bytes(candidate);
        if (candidateBytes - bodyBytes[index] > bestBytes) {
          bestIndex = index;
          bestPrefix = candidate;
          bestBytes = candidateBytes - bodyBytes[index];
        }
      }
      if (bestIndex < 0) break;
      body[bestIndex] = bestPrefix;
      bodyBytes[bestIndex] += bestBytes;
      remaining -= bestBytes;
      active = active.filter((index) => bodyBytes[index] < sectionBytes[index]);
      continue;
    }

    remaining -= consumed;
    active = next;
  }

  const truncatedCount = bodyBytes.filter((bytes, index) => bytes < sectionBytes[index]).length;
  const marker = truncationMarker(truncatedCount);
  return summary + body.filter(Boolean).join("") + marker;
}



// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Last path segment of a fsPath (POSIX or Windows mixed). */
export function repoNameFromFsPath(fsPath: string): string {
  if (!fsPath) return "";
  // Normalize backslashes for Windows-pasted root paths.
  const normalized = fsPath.replace(/\\/g, "/");
  const trimmed = normalized.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function toRelativePath(rootFsPath: string, absoluteFsPath: string): string {
  const root = rootFsPath.replace(/\\/g, "/").replace(/\/+$/, "");
  let abs = absoluteFsPath.replace(/\\/g, "/");
  if (abs.startsWith(root + "/")) abs = abs.slice(root.length + 1);
  else if (abs.startsWith(root)) abs = abs.slice(root.length).replace(/^\/+/, "");
  return abs;
}

// vscode.git `Status` enum → short label (unknown values fall back to "M").
const STATUS_LABEL: Readonly<Record<number, string>> = {
  0: "M", 1: "A", 2: "D", 3: "R", 4: "C", 5: "M", 6: "D", 7: "A", 9: "A", 10: "R", 11: "T",
};

function changesForScope(repo: GitRepositoryLike, scope: "staged" | "unstaged"): GitChangeLike[] {
  const state = repo.state;
  return scope === "staged"
    ? [...(state?.indexChanges ?? [])]
    : [...(state?.workingTreeChanges ?? []), ...(state?.mergeChanges ?? [])];
}

function fileListRows(repo: GitRepositoryLike, scope: "staged" | "unstaged"): string[] {
  const root = repo.rootUri?.fsPath ?? "";
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const change of changesForScope(repo, scope)) {
    if (!change?.uri || typeof change.uri.fsPath !== "string") continue;
    const rel = toRelativePath(root, change.uri.fsPath);
    if (!rel || seen.has(rel)) continue;
    seen.add(rel);
    rows.push(`${STATUS_LABEL[change.status ?? 5] ?? "M"} ${rel}`);
  }
  return rows;
}

/** Cheap fingerprint of the change set (status + path) — no diff read. */
export function fileListFingerprint(repo: GitRepositoryLike, scope: "staged" | "unstaged"): string {
  return createHash("sha256").update(`files:${scope}\n${fileListRows(repo, scope).join("\n")}`, "utf8").digest("hex");
}

/**
 * Large change set summary: status counts, top directories and a bounded
 * file list. Never calls `repo.diff()`, so it is O(file count) and instant.
 */
export function buildFileListSummary(rows: readonly string[]): string {
  const counts = new Map<string, number>();
  const dirs = new Map<string, number>();
  const exts = new Map<string, number>();
  for (const row of rows) {
    const [status, path] = [row.slice(0, 1), row.slice(2)];
    counts.set(status, (counts.get(status) ?? 0) + 1);
    const parts = path.split("/");
    const dir = parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts.length > 1 ? parts[0] : ".";
    dirs.set(dir, (dirs.get(dir) ?? 0) + 1);
    const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase() ?? "(none)";
    exts.set(ext, (exts.get(ext) ?? 0) + 1);
  }
  const top = (map: Map<string, number>, n: number) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`).join(", ");
  const statusNames: Record<string, string> = { A: "added", M: "modified", D: "deleted", R: "renamed", C: "copied", T: "type-changed" };
  const header =
    `Large change set: ${rows.length} files (diff omitted for speed).\n` +
    `Status: ${[...counts.entries()].map(([k, v]) => `${statusNames[k] ?? k} ${v}`).join(", ")}\n` +
    `Top directories: ${top(dirs, 8)}\n` +
    `File types: ${top(exts, 8)}\n` +
    "Files (status path):\n";
  const marker = (n: number) => `… [${n} more file(s)]\n`;
  let out = header;
  let used = utf8Bytes(out);
  const reserve = utf8Bytes(marker(rows.length));
  let index = 0;
  for (; index < rows.length; index++) {
    const line = `${rows[index].length > MAX_COMMIT_PATH_CHARS + 2 ? `${rows[index].slice(0, MAX_COMMIT_PATH_CHARS + 1)}…` : rows[index]}\n`;
    const bytes = utf8Bytes(line);
    if (used + bytes + reserve > GIT_DIFF_MAX_BYTES) break;
    out += line;
    used += bytes;
  }
  if (index < rows.length) out += marker(rows.length - index);
  return out;
}

function fileListInput(
  repo: GitRepositoryLike,
  scope: "staged" | "unstaged",
  trace?: GitDiffTrace,
): CommitDiffInput {
  const rows = fileListRows(repo, scope);
  const diffText = buildFileListSummary(rows);
  const head = repo.state?.HEAD;
  trace?.("git.diff.selected", {
    staged: scope === "staged",
    hasChanges: true,
    mode: "files",
    originalDiffChars: 0,
    sentDiffChars: diffText.length,
    originalDiffBytes: 0,
    sentDiffBytes: utf8Bytes(diffText),
    truncated: false,
    fileCount: rows.length,
    filesOmitted: 0,
    filesCapped: false,
  });
  return {
    repoName: repoNameFromFsPath(repo.rootUri?.fsPath ?? ""),
    branch: head && typeof head.name === "string" ? head.name : undefined,
    // The summary already lists files; keep the prompt's separate list empty.
    files: [],
    diffText,
    scope,
    diffFingerprint: fileListFingerprint(repo, scope),
    mode: "files",
  };
}

/** Bound oversized diffs by file, preserving a complete status summary. */
export function truncateDiff(text: string): string {
  return boundedDiff(text);
}

// ---------------------------------------------------------------------------
// Repository / API seams
// ---------------------------------------------------------------------------

/** Returns a repository only when selection is unambiguous. */
export function pickRepository(api: GitApiLike | undefined): GitRepositoryLike | null {
  if (!api || api.repositories.length !== 1) return null;
  return api.repositories[0] ?? null;
}

/** Prefer the repository (or SCM source control root) supplied by the invoking command. */
export function repositoryFromCommandArgument(
  api: GitApiLike | undefined,
  ...args: readonly unknown[]
): GitRepositoryLike | null {
  if (!api) return null;
  for (const arg of args) {
    const exactMatch = api.repositories.find((repo) => repo === arg);
    if (exactMatch) return exactMatch;
    if (typeof arg !== "object" || arg === null || !("rootUri" in arg)) continue;
    const rootUri = arg.rootUri;
    if (typeof rootUri !== "object" || rootUri === null || !("fsPath" in rootUri)) continue;
    const fsPath = rootUri.fsPath;
    if (typeof fsPath !== "string") continue;
    const matches = api.repositories.filter((repo) => repo.rootUri.fsPath === fsPath);
    if (matches.length === 1) return matches[0] ?? null;
  }
  return null;

}

/**
 * The only vscode-bound function in this module. Returns the vscode.git
 * extension's API(1) when available, otherwise `undefined`.
 */
export function getGitApi(): GitApiLike | undefined {
  const ext = vscode.extensions.getExtension<{ getAPI(id: number): GitApiLike }>("vscode.git");
  if (!ext) return undefined;
  if (ext.isActive === false) return undefined;
  if (!ext.exports || typeof ext.exports.getAPI !== "function") return undefined;
  return ext.exports.getAPI(1);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Collect a prompt-ready `CommitDiffInput` from the given git repository.
 *
 * Algorithm (frozen, PLAN §2):
 *   1. staged   = await repo.diff(true); if staged.trim() non-empty → use it.
 *   2. else     = await repo.diff();      if that trims empty → return null.
 *   3. files    = deduped repo-relative paths from the state group that
 *                 corresponds to the chosen diff (indexChanges for staged,
 *                 workingTreeChanges for unstaged); mergeChanges are included
 *                 only when the unstaged fallback is selected.
 *   4. repoName = basename of rootUri.fsPath.
 *   5. branch   = state.HEAD?.name when present, else undefined.
 *   6. diffText = the chosen diff, truncated at GIT_DIFF_MAX_BYTES.
 */
export async function collectCommitDiff(
  repo: GitRepositoryLike,
  trace?: GitDiffTrace,
): Promise<CommitDiffInput | null> {
  // Speed fast path: a large change set never reads `git diff` (can be MBs
  // and seconds long). File names + status are enough for a commit subject.
  const fastState = repo.state;
  const stagedChanges = fastState?.indexChanges ?? [];
  const unstagedChanges = [
    ...(fastState?.workingTreeChanges ?? []),
    ...(fastState?.mergeChanges ?? []),
  ];
  if (stagedChanges.length > FILE_LIST_MODE_THRESHOLD) {
    return fileListInput(repo, "staged", trace);
  }
  if (stagedChanges.length === 0 && unstagedChanges.length > FILE_LIST_MODE_THRESHOLD) {
    return fileListInput(repo, "unstaged", trace);
  }
  const stagedStartedAt = trace ? performance.now() : 0;
  const stagedRaw = await repo.diff(true);
  trace?.("git.diff.complete", {
    staged: true,
    durationMs: Math.round((performance.now() - stagedStartedAt) * 10) / 10,
    resultChars: typeof stagedRaw === "string" ? stagedRaw.length : 0,
  });
  let chosen: string;
  let stagedSelected = false;
  if (typeof stagedRaw === "string" && stagedRaw.trim().length > 0) {
    chosen = stagedRaw;
    stagedSelected = true;
  } else {
    const unstagedStartedAt = trace ? performance.now() : 0;
    const unstagedRaw = await repo.diff(false);
    trace?.("git.diff.complete", {
      staged: false,
      durationMs: Math.round((performance.now() - unstagedStartedAt) * 10) / 10,
      resultChars: typeof unstagedRaw === "string" ? unstagedRaw.length : 0,
    });
    if (typeof unstagedRaw !== "string" || unstagedRaw.trim().length === 0) {
      trace?.("git.diff.selected", {
        staged: false,
        hasChanges: false,
        originalDiffChars: 0,
        sentDiffChars: 0,
        originalDiffBytes: 0,
        sentDiffBytes: 0,
        truncated: false,
        fileCount: 0,
        filesOmitted: 0,
        filesCapped: false,
      });
      return null;
    }
    chosen = unstagedRaw;
  }

  const state = repo.state ?? ({} as GitRepositoryLike["state"]);
  const seen = new Set<string>();
  const files: string[] = [];
  const rootFsPath = repo.rootUri?.fsPath ?? "";
  const push = (change: GitChangeLike | undefined) => {
    if (!change || !change.uri || typeof change.uri.fsPath !== "string") return;
    const rel = toRelativePath(rootFsPath, change.uri.fsPath);
    if (!rel || seen.has(rel)) return;
    seen.add(rel);
    files.push(rel.length > MAX_COMMIT_PATH_CHARS
      ? `${rel.slice(0, MAX_COMMIT_PATH_CHARS - 1)}…`
      : rel);
  };
  const selectedChanges = stagedSelected
    ? state.indexChanges
    : [...(state.workingTreeChanges ?? []), ...(state.mergeChanges ?? [])];
  for (const c of selectedChanges ?? []) push(c);

  const filesOmitted = Math.max(0, files.length - MAX_COMMIT_FILES);
  const filesCapped = files.slice(0, MAX_COMMIT_FILES);
  const branch = state.HEAD && typeof state.HEAD.name === "string" ? state.HEAD.name : undefined;

  const diffText = truncateDiff(
    chosen.length > RAW_DIFF_SCAN_MAX_CHARS ? chosen.slice(0, RAW_DIFF_SCAN_MAX_CHARS) : chosen,
  );
  const diffFingerprint = createHash("sha256").update(chosen, "utf8").digest("hex");
  if (trace) {
    trace("git.diff.selected", {
      staged: stagedSelected,
      hasChanges: true,
      originalDiffChars: chosen.length,
      sentDiffChars: diffText.length,
      originalDiffBytes: Buffer.byteLength(chosen, "utf8"),
      sentDiffBytes: Buffer.byteLength(diffText, "utf8"),
      truncated: diffText !== chosen,
      fileCount: filesCapped.length,
      filesOmitted,
      filesCapped: filesOmitted > 0,
    });
  }
  return {
    repoName: repoNameFromFsPath(rootFsPath),
    branch,
    files: filesCapped,
    diffText,
    scope: stagedSelected ? "staged" : "unstaged",
    diffFingerprint,
  };
}

/** Re-read only the originally selected Git scope and compare its full hash. */
export async function isCommitDiffCurrent(
  repo: GitRepositoryLike,
  expected: Pick<CommitDiffInput, "branch" | "scope" | "diffFingerprint" | "mode">,
): Promise<boolean> {
  if ((repo.state?.HEAD?.name ?? undefined) !== expected.branch) return false;
  if (expected.mode === "files") {
    // File-list snapshots compare the git state only — never re-read the diff.
    return fileListFingerprint(repo, expected.scope) === expected.diffFingerprint;
  }
  const current = await repo.diff(expected.scope === "staged");
  if (typeof current !== "string" || current.trim().length === 0) return false;
  const fingerprint = createHash("sha256").update(current, "utf8").digest("hex");
  return fingerprint === expected.diffFingerprint;
}