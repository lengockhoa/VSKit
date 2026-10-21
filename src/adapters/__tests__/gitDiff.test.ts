// src/adapters/__tests__/gitDiff.test.ts
//
// TASK-GC-002 — gitDiff adapter (vscode.git extension API).
//
// Tests #1-#6 from the task. Fakes implement `GitRepositoryLike` structurally;
// the `vscode` mock is only required for the `getGitApi()` cases (#6).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// vscode is only used by `getGitApi` inside `gitDiff.ts`; mock the whole module
// here so the suite can load in node. Each getGitApi test rewrites the mock
// via the `vscode` object re-exported below.
vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));
import * as vscode from "vscode";
import {
  GIT_DIFF_MAX_BYTES,
  collectCommitDiff,
  getGitApi,
  isCommitDiffCurrent,
  pickRepository,
  repositoryFromCommandArgument,
  type GitRepositoryLike,
} from "../gitDiff";

beforeEach(() => {
  (vscode.extensions.getExtension as unknown as Mock).mockReset();
});

// ---------------------------------------------------------------------------
// Fakes — minimal `GitRepositoryLike` shapes
// ---------------------------------------------------------------------------

function makeRepo(overrides: {
  rootFsPath?: string;
  staged?: string;
  unstaged?: string;
  headName?: string;
  indexChanges?: { uri: { fsPath: string } }[];
  workingTreeChanges?: { uri: { fsPath: string } }[];
  mergeChanges?: { uri: { fsPath: string } }[];
}): GitRepositoryLike {
  const root = overrides.rootFsPath ?? "/repo/VSKit";
  const staged = overrides.staged;
  const unstaged = overrides.unstaged;
  return {
    rootUri: { fsPath: root },
    diff: ((cached?: boolean) => {
      if (cached) return Promise.resolve(staged ?? "");
      return Promise.resolve(unstaged ?? "");
    }) as GitRepositoryLike["diff"],
    state: {
      HEAD: overrides.headName !== undefined ? { name: overrides.headName } : undefined,
      indexChanges: overrides.indexChanges ?? [],
      workingTreeChanges: overrides.workingTreeChanges ?? [],
      mergeChanges: overrides.mergeChanges ?? [],
    },
    inputBox: { value: "" },
  };
}

// ===========================================================================
// #1 — staged diff preferred
// ===========================================================================
describe("gitDiff — collectCommitDiff: staged preferred", () => {
  it("returns staged text, deduped files, repoName, branch", async () => {
    const repo = makeRepo({
      rootFsPath: "/home/dev/VSKit",
      staged: "diff --git a/src/a.ts\n+staged line\n",
      unstaged: "diff --git a/src/b.ts\n+unstaged line\n",
      headName: "main",
      indexChanges: [
        { uri: { fsPath: "/home/dev/VSKit/src/a.ts" } },
        { uri: { fsPath: "/home/dev/VSKit/src/shared.ts" } },
      ],
      workingTreeChanges: [
        { uri: { fsPath: "/home/dev/VSKit/src/shared.ts" } }, // dup
        { uri: { fsPath: "/home/dev/VSKit/src/b.ts" } },
      ],
    });
    const result = await collectCommitDiff(repo);
    expect(result).not.toBeNull();
    expect(result!.repoName).toBe("VSKit");
    expect(result!.branch).toBe("main");
    expect(result!.diffText).toBe("diff --git a/src/a.ts\n+staged line\n");
    // Only files represented by the selected staged diff are included.
    // Unstaged-only files must not be shown alongside staged patch content.
    expect(result!.files.sort()).toEqual(["src/a.ts", "src/shared.ts"]);
  });
});

// ===========================================================================
// #2 — nothing to commit → null
// ===========================================================================
describe("gitDiff — collectCommitDiff: empty diff", () => {
  it("returns null when both staged and unstaged are whitespace-only", async () => {
    const repo = makeRepo({
      staged: "   \n  ",
      unstaged: "   \n  ",
    });
    const result = await collectCommitDiff(repo);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// #3 — fallback to unstaged when staged empty
// ===========================================================================
describe("gitDiff — collectCommitDiff: fall back to unstaged", () => {
  it("uses unstaged when staged trims empty", async () => {
    const repo = makeRepo({
      staged: "",
      unstaged: "diff --git a/x.ts\n+line\n",
      indexChanges: [
        { uri: { fsPath: "/repo/VSKit/staged-only.ts" } },
      ],
      workingTreeChanges: [
        { uri: { fsPath: "/repo/VSKit/x.ts" } },
      ],
      mergeChanges: [
        { uri: { fsPath: "/repo/VSKit/merge.ts" } },
      ],
    });
    const result = await collectCommitDiff(repo);
    expect(result).not.toBeNull();
    expect(result!.diffText).toBe("diff --git a/x.ts\n+line\n");
    expect(result!.files.sort()).toEqual(["merge.ts", "x.ts"]);
  });

  it("does not mix unstaged-only files into a selected staged diff", async () => {
    const repo = makeRepo({
      staged: "diff --git a/staged.ts\n+line\n",
      unstaged: "diff --git a/unstaged.ts\n+line\n",
      indexChanges: [
        { uri: { fsPath: "/repo/VSKit/staged.ts" } },
      ],
      workingTreeChanges: [
        { uri: { fsPath: "/repo/VSKit/unstaged.ts" } },
      ],
    });

    const result = await collectCommitDiff(repo);

    expect(result).not.toBeNull();
    expect(result!.files).toEqual(["staged.ts"]);
  });

  it("deduplicates selected unstaged and merge files", async () => {
    const repo = makeRepo({
      staged: "",
      unstaged: "diff --git a/working.ts\n+line\n",
      workingTreeChanges: [
        { uri: { fsPath: "/repo/VSKit/shared.ts" } },
        { uri: { fsPath: "/repo/VSKit/working.ts" } },
      ],
      mergeChanges: [
        { uri: { fsPath: "/repo/VSKit/shared.ts" } },
        { uri: { fsPath: "/repo/VSKit/merge.ts" } },
      ],
    });

    const result = await collectCommitDiff(repo);

    expect(result).not.toBeNull();
    expect(result!.files.sort()).toEqual(["merge.ts", "shared.ts", "working.ts"]);
  });
});

// ===========================================================================
// #4 — 12 KB truncation
// ===========================================================================
describe("gitDiff — collectCommitDiff: bounded per-file diff", () => {
  it("keeps a complete file summary and useful hunks from files across an oversized diff", async () => {
    const first = `diff --git a/src/one.ts b/src/one.ts\nindex 1..2 100644\n--- a/src/one.ts\n+++ b/src/one.ts\n@@ -1 +1 @@\n-${"a".repeat(16000)}\n+first change\n`;
    const second = `diff --git a/src/two.ts b/src/two.ts\nindex 1..2 100644\n--- a/src/two.ts\n+++ b/src/two.ts\n@@ -1 +1 @@\n-old\n+second change\n`;
    const third = `diff --git a/README.md b/README.md\nindex 1..2 100644\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+docs change\n`;
    const result = await collectCommitDiff(makeRepo({ staged: first + second + third }));
    expect(result).not.toBeNull();
    expect(Buffer.byteLength(result!.diffText, "utf8")).toBeLessThanOrEqual(GIT_DIFF_MAX_BYTES);
    expect(result!.diffText).toContain("Changed files:");
    expect(result!.diffText).toContain("src/one.ts");
    expect(result!.diffText).toContain("src/two.ts");
    expect(result!.diffText).toContain("README.md");
    expect(result!.diffText).toContain("second change");
    expect(result!.diffText).toContain("docs change");
    expect(result!.diffText).toContain("partial");
    expect(result!.diffText).toContain("src/one.ts");
  });

  it("preserves rename, deletion, and binary markers when oversized diffs are summarized", async () => {
    const metadataDiff = `diff --git a/old.txt b/new.txt\nsimilarity index 90%\nrename from old.txt\nrename to new.txt\ndiff --git a/gone.ts b/gone.ts\ndeleted file mode 100644\n--- a/gone.ts\n+++ /dev/null\ndiff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ\n`;
    const largeDiff = `diff --git a/src/large.ts b/src/large.ts\n@@ -1 +1 @@\n+${"x".repeat(GIT_DIFF_MAX_BYTES)}\n`;
    const result = await collectCommitDiff(makeRepo({ staged: metadataDiff + largeDiff }));
    expect(result).not.toBeNull();
    expect(Buffer.byteLength(result!.diffText, "utf8")).toBeLessThanOrEqual(GIT_DIFF_MAX_BYTES);
    expect(result!.diffText).toContain("old.txt");
    expect(result!.diffText).toContain("new.txt");
    expect(result!.diffText).toContain("gone.ts");
    expect(result!.diffText).toContain("image.png");
    expect(result!.diffText).toContain("rename from old.txt");
    expect(result!.diffText).toContain("rename to new.txt");
    expect(result!.diffText).toContain("deleted file mode 100644");
    expect(result!.diffText).toContain("Binary files");
    expect(result!.diffText).toContain("partial diff");
  });

  it("enforces the context budget in UTF-8 bytes for non-ASCII diffs", async () => {
    const diff = `diff --git a/src/unicode.ts b/src/unicode.ts\n@@ -1 +1 @@\n+${"界".repeat(GIT_DIFF_MAX_BYTES)}\n`;
    const events: Array<[string, Record<string, string | number | boolean>]> = [];
    const result = await collectCommitDiff(makeRepo({ staged: diff }), (event, metadata) => {
      events.push([event, { ...metadata }]);
    });

    expect(result).not.toBeNull();
    expect(Buffer.byteLength(result!.diffText, "utf8")).toBeLessThanOrEqual(GIT_DIFF_MAX_BYTES);
    expect(result!.diffText).toContain("src/unicode.ts");
    expect(result!.diffText).toContain("partial diff");
    const selected = events.find(([event]) => event === "git.diff.selected")?.[1];
    expect(selected).toMatchObject({
      originalDiffBytes: Buffer.byteLength(diff, "utf8"),
      sentDiffBytes: Buffer.byteLength(result!.diffText, "utf8"),
      truncated: true,
    });
    expect(selected).not.toHaveProperty("diffText");
  });

  it("keeps the final context within budget when file summaries overflow", async () => {
    const diff = Array.from({ length: 1000 }, (_, index) => {
      const path = `src/file-${String(index).padStart(4, "0")}-with-a-long-name.ts`;
      return `diff --git a/${path} b/${path}\nnew file mode 100644\n`;
    }).join("");
    const result = await collectCommitDiff(makeRepo({ staged: diff }));

    expect(result).not.toBeNull();
    expect(Buffer.byteLength(result!.diffText, "utf8")).toBeLessThanOrEqual(GIT_DIFF_MAX_BYTES);
    expect(result!.diffText).toContain("additional changed file(s) omitted from summary");
  });
});

describe("gitDiff — diff freshness fingerprint", () => {
  it("distinguishes complete diffs even when their sent prefixes are identical", async () => {
    const prefix = `diff --git a/src/file.ts b/src/file.ts\n${"x".repeat(GIT_DIFF_MAX_BYTES)}`;
    const first = await collectCommitDiff(makeRepo({ staged: prefix + "first" }));
    const second = await collectCommitDiff(makeRepo({ staged: prefix + "second" }));
    expect(first!.diffText).toBe(second!.diffText);
    expect(first!.scope).toBe("staged");
    expect(first!.diffFingerprint).not.toBe(second!.diffFingerprint);
  });
});

describe("gitDiff — snapshot freshness", () => {
  it("checks only the selected scope and rejects a changed diff or branch", async () => {
    const repo = makeRepo({ staged: "diff --git a/a.ts\n+old\n", headName: "main" });
    const snapshot = await collectCommitDiff(repo);
    expect(snapshot).not.toBeNull();
    const diff = vi.spyOn(repo, "diff");

    expect(await isCommitDiffCurrent(repo, snapshot!)).toBe(true);
    expect(diff).toHaveBeenLastCalledWith(true);

    diff.mockResolvedValue("diff --git a/a.ts\n+new\n");
    expect(await isCommitDiffCurrent(repo, snapshot!)).toBe(false);
    diff.mockResolvedValue("diff --git a/a.ts\n+old\n");
    repo.state.HEAD = { name: "other" };
    expect(await isCommitDiffCurrent(repo, snapshot!)).toBe(false);
  });
  it("rejects an unstaged snapshot after its changes are staged while generation waits", async () => {
    const change = "diff --git a/a.ts\n+change\n";
    const repo = makeRepo({ unstaged: change, headName: "main" });
    const snapshot = await collectCommitDiff(repo);
    expect(snapshot?.scope).toBe("unstaged");

    const diff = vi.spyOn(repo, "diff").mockImplementation(async (cached?: boolean) =>
      cached ? change : "",
    );
    expect(await isCommitDiffCurrent(repo, snapshot!)).toBe(false);
    expect(diff).toHaveBeenCalledWith(false);
  });

});

// ===========================================================================
// #5 — missing data tolerated
// ===========================================================================
describe("gitDiff — collectCommitDiff: missing data tolerated", () => {
  it("returns diff with undefined branch and empty files when state is absent", async () => {
    // Build a repo whose state is a barebones object (no HEAD, no changes arrays).
    const repo: GitRepositoryLike = {
      rootUri: { fsPath: "/repo/MyApp" },
      diff: ((cached?: boolean) =>
        Promise.resolve(cached ? "diff --git a/y.ts\n+x\n" : "")) as GitRepositoryLike["diff"],
      state: {} as unknown as GitRepositoryLike["state"],
      inputBox: { value: "" },
    };
    const result = await collectCommitDiff(repo);
    expect(result).not.toBeNull();
    expect(result!.repoName).toBe("MyApp");
    expect(result!.branch).toBeUndefined();
    expect(result!.files).toEqual([]);
    expect(result!.diffText).toBe("diff --git a/y.ts\n+x\n");
  });
});

// ===========================================================================
// #6 — getGitApi + pickRepository
// ===========================================================================
describe("gitDiff — getGitApi + pickRepository", () => {
  function installExtensionMock(opts: {
    present: boolean;
    isActive?: boolean;
    api?: GitApiLike;
    hasExports?: boolean;
  }): void {
    const extensionMock: {
      isActive?: boolean;
      exports?: { getAPI: Mock };
    } = {};
    if (opts.isActive !== undefined) extensionMock.isActive = opts.isActive;
    const wantExports = opts.hasExports ?? (opts.api !== undefined || opts.present);
    if (wantExports) {
      extensionMock.exports = {
        getAPI: vi.fn().mockReturnValue(opts.api ?? ({} as GitApiLike)),
      };
    }
    (vscode.extensions as unknown as { getExtension: Mock }).getExtension = vi.fn(
      (id: string) => {
        if (!opts.present) return undefined;
        return { id, ...extensionMock };
      },
    );
  }

  it("returns api when extension is active and exports exist", () => {
    const api: GitApiLike = { repositories: [] };
    installExtensionMock({ present: true, isActive: true, api });
    const result = getGitApi();
    expect(result).toBe(api);
  });

  it("returns undefined when extension is not present", () => {
    installExtensionMock({ present: false });
    expect(getGitApi()).toBeUndefined();
  });

  it("returns undefined when extension is inactive", () => {
    installExtensionMock({ present: true, isActive: false });
    expect(getGitApi()).toBeUndefined();
  });

  it("returns undefined when exports is undefined", () => {
    installExtensionMock({ present: true, isActive: true, hasExports: false });
    expect(getGitApi()).toBeUndefined();
  });

  it("pickRepository returns a repository only when exactly one is available", () => {
    const repo = makeRepo({});
    const api: GitApiLike = { repositories: [repo] };
    expect(pickRepository(api)).toBe(repo);
    expect(pickRepository({ repositories: [repo, makeRepo({ rootFsPath: "/repo/Other" })] })).toBeNull();
  });

  it("pickRepository returns null when no repositories", () => {
    const api: GitApiLike = { repositories: [] };
    expect(pickRepository(api)).toBeNull();
  });

  it("pickRepository tolerates undefined api", () => {
    expect(pickRepository(undefined)).toBeNull();
  });
  it("resolves the repository carried by a command invocation before a picker", () => {
    const first = makeRepo({ rootFsPath: "/repo/First" });
    const second = makeRepo({ rootFsPath: "/repo/Second" });
    const api: GitApiLike = { repositories: [first, second] };

    expect(repositoryFromCommandArgument(api, second)).toBe(second);
    expect(
      repositoryFromCommandArgument(api, {
        rootUri: second.rootUri,
        inputBox: second.inputBox,
      }),
    ).toBe(second);
    expect(repositoryFromCommandArgument(api, { rootUri: { fsPath: "/repo/Other" } })).toBeNull();
  });
});