// Pure prompt and normalization tests for SCM commit generation.
import { describe, expect, it } from "vitest";
import { buildCommitPrompt, sanitizeCommitMessage, COMMIT_SUBJECT_MAX_CHARS } from "../commitMessage";

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

  it("clamps only the subject to the 72-character limit", () => {
    expect(COMMIT_SUBJECT_MAX_CHARS).toBe(72);
    expect(sanitizeCommitMessage("x".repeat(90))).toHaveLength(72);
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
