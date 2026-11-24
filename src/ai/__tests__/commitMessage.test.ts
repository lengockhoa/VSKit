// Pure prompt and normalization tests for SCM commit generation.
import { describe, expect, it } from "vitest";
import { buildCommitPrompt, buildFallbackCommitMessage, clampAtWord, extractChangedPaths, sanitizeCommitMessage, COMMIT_SUBJECT_MAX_CHARS } from "../commitMessage";

describe("buildCommitPrompt", () => {
  it("includes repository, branch, changed paths, and diff", () => {
    const messages = buildCommitPrompt({ repoName: "VSKit", branch: "feature/example", files: ["src/a.ts"], diffText: "+change" });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("ONLY that single line");
    expect(messages[1].content).toContain("Repo: VSKit");
    expect(messages[1].content).toContain("Branch: feature/example");
    expect(messages[1].content).toContain("src/a.ts");
    expect(messages[1].content).toContain("+change");
  });

  it("omits an absent branch", () => {
    const [, user] = buildCommitPrompt({ repoName: "VSKit", files: [], diffText: "" });
    expect(user.content).not.toContain("Branch:");
  });
});

describe("sanitizeCommitMessage", () => {
  it("normalizes fences, one matching quote layer, markdown prefixes, and multiline output", () => {
    expect(sanitizeCommitMessage('```text\n"- feat(db): add index"\nExplanation\n```')).toBe("feat(db): add index");
  });

  it("selects the first non-empty line and trims it", () => {
    expect(sanitizeCommitMessage(" \n\n feat: update  \nbody")).toBe("feat: update");
  });

  it("keeps full sentences and never cuts mid-word", () => {
    const full = "fix(credit): cập nhật quyền truy cập và chuẩn hóa đường dẫn hạn mức tín dụng";
    expect(full.length).toBeGreaterThan(72);
    expect(sanitizeCommitMessage(full)).toBe(full);
    expect(COMMIT_SUBJECT_MAX_CHARS).toBe(150);
    expect(sanitizeCommitMessage("x".repeat(200))).toHaveLength(COMMIT_SUBJECT_MAX_CHARS);
  });

  it("returns empty for empty or whitespace-only input", () => {
    expect(sanitizeCommitMessage("")).toBe("");
    expect(sanitizeCommitMessage(" \n\t ")).toBe("");
  });

  it("does not apply style or language validation", () => {
    expect(sanitizeCommitMessage("Improve database cache")).toBe("Improve database cache");
    expect(sanitizeCommitMessage("feat: sửa lỗi hiển thị")).toBe("feat: sửa lỗi hiển thị");
  });

  it("preserves punctuation and internal whitespace", () => {
    expect(sanitizeCommitMessage("feat:  use #tag!")).toBe("feat:  use #tag!");
  });

  it("removes only matching surrounding quotes", () => {
    expect(sanitizeCommitMessage("'feat: update'")).toBe("feat: update");
    expect(sanitizeCommitMessage("'feat: update\"")).toBe("'feat: update\"");
  });

  it("handles CRLF and never returns body text", () => {
    expect(sanitizeCommitMessage("fix: update\r\nsecret body")).toBe("fix: update");
  });
});

describe("buildFallbackCommitMessage", () => {
  it("names up to three files and counts the rest within 72 chars", () => {
    expect(buildFallbackCommitMessage(["src/a.ts"])).toBe("chore: cập nhật a.ts");
    const many = Array.from({ length: 300 }, (_, i) => `src/dir/file-with-long-name-${i}.ts`);
    const message = buildFallbackCommitMessage(many);
    expect(message.length).toBeLessThanOrEqual(COMMIT_SUBJECT_MAX_CHARS);
    expect(message).toMatch(/^chore: cập nhật .+ và \d+ file khác$/);
  });

  it("picks docs/test types and handles no files", () => {
    expect(buildFallbackCommitMessage(["docs/a.md", "README.md"])).toBe("docs: cập nhật a.md, README.md");
    expect(buildFallbackCommitMessage(["src/__tests__/x.test.ts"])).toBe("test: cập nhật x.test.ts");
    expect(buildFallbackCommitMessage([])).toBe("chore: cập nhật mã nguồn");
  });

  it("extracts paths from diff headers and file-list rows", () => {
    expect(extractChangedPaths("diff --git a/src/a.ts b/src/a.ts\n+x\ndiff --git a/b.md b/b.md\n")).toEqual(["src/a.ts", "b.md"]);
    expect(extractChangedPaths("Files (status path):\nA src/x.ts\nM docs/y.md\n")).toEqual(["src/x.ts", "docs/y.md"]);
  });

  it("file-list mode prompt carries the summary without a Diff section", () => {
    const [, user] = buildCommitPrompt({ repoName: "VSKit", files: [], diffText: "Large change set: 300 files", mode: "files" });
    expect(user.content).toContain("Large change set: 300 files");
    expect(user.content).not.toContain("Diff:");
  });
});

describe("sanitizeCommitMessage — stray scripts", () => {
  it("drops trailing non-Latin glitch tokens but keeps Vietnamese", () => {
    expect(sanitizeCommitMessage("feat(git): giữ thông tin khi vượt ngân sách byte ગુજરાતી")).toBe("feat(git): giữ thông tin khi vượt ngân sách byte");
    expect(sanitizeCommitMessage("fix: sửa lỗi đường dẫn $(edit) ở giao diện tối")).toBe("fix: sửa lỗi đường dẫn $(edit) ở giao diện tối");
  });
});

describe("clampAtWord", () => {
  it("cuts at a word boundary and drops dangling connectors", () => {
    const text = "fix(credit): cập nhật quyền truy cập và chuẩn hóa đường dẫn hạn mức tín dụng";
    expect(clampAtWord(text, 69)).toBe("fix(credit): cập nhật quyền truy cập và chuẩn hóa đường dẫn hạn mức");
    expect(clampAtWord("feat: thêm bảng users và", 23)).toBe("feat: thêm bảng users");
    expect(clampAtWord("feat: add cache for the", 22)).toBe("feat: add cache");
    expect(clampAtWord("short", 72)).toBe("short");
  });
});
