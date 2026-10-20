// src/__tests__/releaseHygiene.test.ts
// Release hygiene guards (TASK-703):
//   - lock root name/version and package identity match package.json.
//   - README documents the lowercase VSKit VSIX pattern.
//   - package.json version remains valid semver.
//
// Đọc động từ file on disk; bump version không phải sửa test.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..");

function readJson<T>(relPath: string): T {
  const raw = fs.readFileSync(path.join(repoRoot, relPath), "utf-8");
  return JSON.parse(raw) as T;
}

interface PackageJson {
  version: string;
  name: string;
  displayName: string;
  publisher: string;
  repository: { url: string };
}

interface PackageLock {
  name?: string;
  version?: string;
  packages?: { "": { name?: string; version?: string } };
}

describe("release hygiene (TASK-703)", () => {
  it("lock root version khớp package.json version (đọc động)", () => {
    const pkg = readJson<PackageJson>("package.json");
    const lock = readJson<PackageLock>("package-lock.json");

    // npm v7+ dùng `packages[""].version`; npm v6 dùng `version` ở root.
    // Accept cả hai để robust qua các npm version.
    const lockRoot =
      lock.packages?.[""]?.version ??
      lock.version ??
      (() => {
        throw new Error(
          "package-lock.json thiếu root version (packages[''].version hoặc top-level version)",
        );
      })();

    expect(lockRoot, "package-lock.json root version phải khớp package.json")
      .toBe(pkg.version);
  });

  it("package identity and lock root agree on the VSKit extension id", () => {
    const pkg = readJson<PackageJson>("package.json");
    const lock = readJson<PackageLock>("package-lock.json");
    expect(pkg.name).toBe("vskit");
    expect(pkg.displayName).toContain("VSKit");
    expect(pkg.publisher).toBe("lengockhoa");
    expect(pkg.repository.url).toBe("https://github.com/lengockhoa/VSKit");
    expect(lock.name).toBe(pkg.name);
    expect(lock.packages?.[""]?.name).toBe(pkg.name);
  });

  it("README and user guide document the current package artifact", () => {
    const pkg = readJson<PackageJson>("package.json");
    const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf-8");
    const userGuide = fs.readFileSync(
      path.join(repoRoot, "docs/vskit-user-guide.md"),
      "utf-8",
    );
    expect(readme).toContain("dist/vskit-<version>.vsix");
    expect(readme).toContain(`dist/vskit-${pkg.version}.vsix`);
    expect(userGuide).toContain(`dist/vskit-${pkg.version}.vsix`);
  });
  it("the paused CI workflow and package scripts do not publish to Marketplace", () => {
    const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf-8");
    const scripts = readJson<{ scripts?: Record<string, string> }>("package.json").scripts ?? {};
    expect(workflow).toContain("npm run compile");
    expect(workflow).not.toMatch(/\bvsce\s+publish\b/i);
    expect(workflow).not.toContain("VSCE_PAT");
    expect(Object.keys(scripts).filter((key) => key.startsWith("publish:"))).toEqual([]);
  });

  it("package.json version match semver X.Y.Z (3 thành phần số)", () => {
    const pkg = readJson<PackageJson>("package.json");
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// .vsix packaging-pollution guards (cycle RES-BAR post-publish cleanup):
//   - `.vscodeignore` phải exclude `node_modules_backup/**` và `.tmp-debug/**`
//     (vsce không đọc .gitignore; chỉ đọc .vscodeignore — guard against the
//     leak that shipped `node_modules_backup/.vite/vitest/results.json` 21 KB
//     + `.tmp-debug/refs.test.ts` vào VSKit-1.53.28.vsix trước khi fix).
//   - `.gitignore` cũng phải có cùng 2 entry — git-side safety net giữ cho
//     working tree clean sau khi các test runner dump cache.
//   - Cả hai guard đọc file on disk, không hardcode — bump version không phải
//     sửa test.
describe(".vsix packaging pollution guards (RES-BAR post-publish)", () => {
  function readLines(relPath: string): string[] {
    return fs
      .readFileSync(path.join(repoRoot, relPath), "utf-8")
      .split(/\r?\n/);
  }

  it(".vscodeignore phải exclude node_modules_backup/**", () => {
    const lines = readLines(".vscodeignore");
    expect(
      lines.some((l) => l.trim() === "node_modules_backup/**"),
      ".vscodeignore phải có dòng 'node_modules_backup/**' để vsce không ship cache directory",
    ).toBe(true);
  });

  it(".vscodeignore phải exclude .tmp-debug/**", () => {
    const lines = readLines(".vscodeignore");
    expect(
      lines.some((l) => l.trim() === ".tmp-debug/**"),
      ".vscodeignore phải có dòng '.tmp-debug/**' để vsce không ship local debug scratch",
    ).toBe(true);
  });

  it(".gitignore phải exclude node_modules_backup/ (git-side safety net)", () => {
    const lines = readLines(".gitignore");
    expect(
      lines.some((l) => l.trim() === "node_modules_backup/"),
      ".gitignore phải có dòng 'node_modules_backup/' để git không track vitest dump cache",
    ).toBe(true);
  });

  it(".gitignore phải exclude .tmp-debug/ (git-side safety net)", () => {
    const lines = readLines(".gitignore");
    expect(
      lines.some((l) => l.trim() === ".tmp-debug/"),
      ".gitignore phải có dòng '.tmp-debug/' để git không track local debug scratch files",
    ).toBe(true);
  });

  it("working tree phải không có file pollution đang tracked trong git", () => {
    // Belt-and-suspenders: nếu .tmp-debug/ hoặc node_modules_backup/ xuất hiện
    // lại trong `git ls-files` thì guard fail-fast. Đây là kênh phát hiện sớm
    // nếu ignore rule bị xoá nhầm bởi một chore commit kế tiếp.
    const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
    const out = execFileSync("git", ["ls-files"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    const tracked = out.split("\n");
    const pollutionTracked = tracked.filter(
      (f) =>
        f === ".tmp-debug/refs.test.ts" ||
        f.startsWith("node_modules_backup/"),
    );
    expect(
      pollutionTracked,
      `git ls-files cho thấy pollution đang tracked: ${pollutionTracked.join(", ")}`,
    ).toEqual([]);
  });
});

// Release confidence profiles (ARP-09) — TASK-ARP09-002:
//   - Named profile keys `profile:fast` / `profile:release` over the SAME stage
//     sets as `verify:*`, deliberately kept in lockstep (roadmap "named profiles").
//   - `profile:fast` byte-identical in effect to `verify:fast` is INTENDED —
//     the deliverable is the named profile key itself, not a third implementation.
//   - Baseline + verify scripts MUST stay byte-identical (regression guard).
// Đọc động từ package.json on disk (same approach as releaseVerify.test.ts).
interface ScriptsPackageJson {
  scripts?: Record<string, string>;
  contributes?: { configuration?: { properties?: Record<string, unknown> } };
}

describe("release confidence profiles (ARP-09)", () => {
  // Expected strings captured literally — pin against silent drift.
  const expectedPinnedScripts: Record<string, string> = {
    test: "vitest run",
    typecheck: "tsc --noEmit",
    compile: "node esbuild.js",
    "test:integration": "vitest run -c vitest.integration.config.ts",
    "verify:fast": "npm run typecheck && npm run compile",
    "verify:release": "npm test && npm run typecheck && npm run compile",
  };

  function readScripts(): Record<string, string> {
    const pkg = readJson<ScriptsPackageJson>("package.json");
    return pkg.scripts ?? {};
  }

  function profileKeys(scripts: Record<string, string>): string[] {
    return Object.keys(scripts).filter((k) => k.startsWith("profile:"));
  }

  it("profile:fast exists and equals the pinned fast-profile string", () => {
    expect(readScripts()["profile:fast"]).toBe("npm run typecheck && npm run compile");
  });

  it("profile:release exists and delegates to the pinned verify:release", () => {
    expect(readScripts()["profile:release"]).toBe("npm run verify:release");
  });

  it("profile:* keys are exactly the two named profiles (no extras)", () => {
    expect(profileKeys(readScripts()).sort()).toEqual(["profile:fast", "profile:release"]);
  });

  it("profile:* values reference ONLY real existing script keys", () => {
    const scripts = readScripts();
    const keys = profileKeys(scripts);
    expect(keys.length, "profile:* keys phải tồn tại để pin này có ý nghĩa").toBeGreaterThan(0);
    const allowed = new Set(Object.keys(scripts));
    for (const key of keys) {
      for (const frag of (scripts[key] ?? "").split("&&")) {
        const t = frag.trim();
        const m = /^npm run (.+)$/.exec(t);
        expect(m, `fragment '${t}' of ${key} is not an 'npm run <key>' invocation`).not.toBeNull();
        expect(allowed.has(m?.[1] as string), `${key} references unknown script '${m?.[1]}'`).toBe(true);
      }
    }
  });

  it("profile:* values have no shell-injection surface", () => {
    const scripts = readScripts();
    const keys = profileKeys(scripts);
    expect(keys.length, "profile:* keys phải tồn tại để pin này có ý nghĩa").toBeGreaterThan(0);
    for (const key of keys) {
      const v = scripts[key] ?? "";
      expect(v).not.toMatch(/[`$]/); // no backticks, no $(...)
      expect(v).not.toMatch(/[;|><]/);
      expect(v).toMatch(/^npm[^`]*$/);
    }
  });

  it("baseline + verify pins preserved byte-identical (ARP-09 regression guard)", () => {
    const scripts = readScripts();
    for (const [k, v] of Object.entries(expectedPinnedScripts)) {
      expect(scripts[k], `script '${k}' must stay byte-identical`).toBe(v);
    }
  });

  it("contributes.configuration.properties does NOT add VSKit.diagnostics.verbosity (YAGNI rejection — PLAN §3)", () => {
    const pkg = readJson<ScriptsPackageJson>("package.json");
    const props = pkg.contributes?.configuration?.properties ?? {};
    expect(Object.keys(props)).not.toContain("VSKit.diagnostics.verbosity");
  });
});
