import { describe, expect, it } from "vitest";
import { checkCommitMessage, GUARD_BLOB_TOKEN_MIN_CHARS, GUARD_SYMBOL_RATIO_MAX } from "../commitMessageGuard";

describe("checkCommitMessage", () => {
  it("rejects empty and whitespace-only text with only the empty reason", () => {
    expect(checkCommitMessage("")).toEqual({ ok: false, reasons: ["empty"] });
    expect(checkCommitMessage(" \n\t ")).toEqual({ ok: false, reasons: ["empty"] });
  });

  it("accepts normal concise subjects without language or word-count validation", () => {
    expect(checkCommitMessage("feat(db): add index to users")).toEqual({ ok: true, reasons: [] });
    expect(checkCommitMessage("feat(db): thêm chỉ mục")).toEqual({ ok: true, reasons: [] });
    expect(checkCommitMessage("tiny")).toEqual({ ok: true, reasons: [] });
  });

  it("rejects unbroken tokens only at the configured boundary", () => {
    expect(checkCommitMessage("a".repeat(GUARD_BLOB_TOKEN_MIN_CHARS - 1)).reasons).not.toContain("unbroken-blob");
    expect(checkCommitMessage("a".repeat(GUARD_BLOB_TOKEN_MIN_CHARS)).reasons).toContain("unbroken-blob");
  });

  it("rejects hash-like content", () => {
    expect(checkCommitMessage("0123456789abcdef".repeat(2)).reasons).toContain("hash-like");
  });

  it("rejects symbol-heavy output above the configured ratio", () => {
    expect(GUARD_SYMBOL_RATIO_MAX).toBe(0.5);
    expect(checkCommitMessage("!!!@@@###").reasons).toContain("symbol-heavy");
  });

  it("rejects reasoning markers, but does not reject ordinary imperative text", () => {
    expect(checkCommitMessage("We need to inspect this").reasons).toContain("reasoning-marker");
    expect(checkCommitMessage("Improve the cache")).toEqual({ ok: true, reasons: [] });
  });

  it("can report independent garbage reasons together", () => {
    const result = checkCommitMessage("```\n" + "a".repeat(GUARD_BLOB_TOKEN_MIN_CHARS) + "\n```\nLet me explain");
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("unbroken-blob");
    expect(result.reasons).toContain("reasoning-marker");
  });

  it("is deterministic and does not mutate input", () => {
    const candidate = "feat(api): sửa endpoint";
    const first = checkCommitMessage(candidate);
    expect(checkCommitMessage(candidate)).toEqual(first);
    expect(candidate).toBe("feat(api): sửa endpoint");
  });
});
