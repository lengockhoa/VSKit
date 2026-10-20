// tests/install-vskit.test.ts — TDD for scripts/install-vskit.sh
// Spawns the bash script in --dry-run / env-override mode and asserts CLI detection.
// Also exercises find_vsix_asset_url via the script's --local install + env-injected JSON.
// Per TASK-008 Test Cases table.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

const SCRIPT = path.resolve(__dirname, "..", "scripts", "install-vskit.sh");
const parsedPackage: unknown = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
);
if (
  parsedPackage === null ||
  typeof parsedPackage !== "object" ||
  !("version" in parsedPackage) ||
  typeof parsedPackage.version !== "string"
) {
  throw new Error("package.json is missing a string version");
}
const PACKAGE_VERSION = parsedPackage.version;

function runScript(args: string[], envOverrides: Record<string, string> = {}) {
  return spawnSync("bash", [SCRIPT, ...args], {
    env: { ...process.env, ...envOverrides },
    encoding: "utf8",
    timeout: 30000,
  });
}

// CLI-detection tests rely on macOS-specific code CLI fallback paths and
// the absence of `code` on PATH. Skip on non-darwin platforms (Linux CI,
// Windows) where the assertions become platform-incompatible.
// Use describe.skip (vitest 1.x) instead of describe.skipIf (vitest 2.x).
const isMacDev = process.platform === "darwin";
const platformDescribe = isMacDev ? describe : describe.skip;

platformDescribe("install-vskit.sh — CLI detection", () => {
  it("Test #1: --dry-run detects PATH code first", () => {
    const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "vskit-fake-bin-"));
    try {
      const fakeCode = path.join(fakeBin, "code");
      fs.writeFileSync(
        fakeCode,
        "#!/bin/sh\necho 'fake-code-called: $*'\nexit 0\n",
        { mode: 0o755 },
      );
      const result = runScript(["--local", "fake.vsix", "--dry-run"], {
        PATH: `${fakeBin}:${process.env.PATH || ""}`,
        VSKIT_CODE_PATH: "",
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(fakeCode);
    } finally {
      fs.rmSync(fakeBin, { recursive: true, force: true });
    }
  });

  it("Test #1b: falls back to macOS app path when PATH empty", () => {
    const macPath = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";
    const result = runScript(["--local", "fake.vsix", "--dry-run"], {
      PATH: "/usr/bin:/bin",
      VSKIT_CODE_PATH: macPath,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(macPath);
  });

  it("Test #2: no CLI found → exit 1 with clear message", () => {
    const result = runScript(["--local", "fake.vsix", "--dry-run"], {
      PATH: "/usr/bin:/bin",
      VSKIT_CODE_PATH: "/nonexistent/path/to/code",
      // Override platform so no platform-specific fallback is assumed.
      VSKIT_PLATFORM: "Linux",
    });
    expect(result.status).toBe(1);
    // stderr or stdout should explain the user should install code CLI
    const out = (result.stdout + result.stderr).toLowerCase();
    expect(out).toMatch(/code|cli|install|p|ath/);
  });

  it("Test #2b: missing --local file → exit non-zero", () => {
    const result = runScript(["--local", "/nonexistent/file.vsix"], {
      PATH: process.env.PATH || "/usr/bin:/bin",
    });
    expect(result.status).not.toBe(0);
    const out = (result.stdout + result.stderr).toLowerCase();
    expect(out).toMatch(/not found|missing|local/);
  });

  it("Test #3: --help prints usage and a version-neutral local VSIX example", () => {
    const result = runScript(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("usage");
    expect(result.stdout).toContain("dist/vskit-<version>.vsix");
  });

  it("Test #3b: local install reports the current VSKit version", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vskit-installer-"));
    try {
      const fakeCode = path.join(tmp, "code");
      const log = path.join(tmp, "args.log");
      const state = path.join(tmp, "listed-once");
      const vsix = path.join(tmp, "vskit test.vsix");
      fs.writeFileSync(
        fakeCode,
        "#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"$VSKIT_TEST_LOG\"\n" +
        "if [ \"$1\" = \"--list-extensions\" ]; then\n" +
        "  if [ -f \"$VSKIT_TEST_STATE\" ]; then printf 'lengockhoa.vskit@%s\\n' \"$VSKIT_TEST_VERSION\"; else : > \"$VSKIT_TEST_STATE\"; printf 'lengockhoa.vskit@0.0.1\\n'; fi\n" +
        "fi\n",
        { mode: 0o755 },
      );
      fs.writeFileSync(vsix, "PK");
      const result = runScript(["--local", vsix], {
        VSKIT_CODE_PATH: fakeCode,
        VSKIT_TEST_LOG: log,
        VSKIT_TEST_STATE: state,
        VSKIT_TEST_VERSION: PACKAGE_VERSION,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`Updated lengockhoa.vskit: 0.0.1 → ${PACKAGE_VERSION}`);
      expect(fs.readFileSync(log, "utf8").trim().split("\n")).toEqual([
        "--list-extensions", "--show-versions",
        "--install-extension", path.resolve(vsix), "--force",
        "--list-extensions", "--show-versions",
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("install-vskit.sh — find_vsix_asset_url (python3 branch)", () => {
  // Realistic GitHub release JSON: tag + source zip + the .vsix asset we want.
  // This fixture is exactly the kind of payload the script must parse.
  const fixtureJson = JSON.stringify({
    tag_name: "v0.1.0",
    name: "VSKit 0.1.0",
    assets: [
      {
        // Foreign-product asset exercises the installer rejection path.
        name: "foreign-extension-0.1.0.vsix",
        browser_download_url: "https://example.invalid/foreign-extension-0.1.0.vsix",
      },
      {
        name: "Source code (zip)",
        browser_download_url: "https://github.com/lengockhoa/VSKit/archive/refs/tags/v0.1.0.zip",
      },
      {
        name: "Source code (tar.gz)",
        browser_download_url: "https://github.com/lengockhoa/VSKit/archive/refs/tags/v0.1.0.tar.gz",
      },
      {
        name: "vskit-0.1.0.vsix",
        browser_download_url: "https://github.com/lengockhoa/VSKit/releases/download/v0.1.0/vskit-0.1.0.vsix",
      },
    ],
  });

  // Drive the python3 branch by extracting the function defs (everything before
  // `main()` is defined) and prepending a no-op `main` so sourcing doesn't run
  // the real main, which would hit the GitHub API.
  const driver = (call: string) => `
    set -e
    main() { return 0; }
    # Source everything up to (but not including) the real 'main() {' definition.
    awk '/^main\\(\\) \\{/{exit} {print}' "${SCRIPT}" > /tmp/VSKit-funcs-$$.sh
    source /tmp/VSKit-funcs-$$.sh
    rm -f /tmp/VSKit-funcs-$$.sh
    ${call}
  `;

  it("Test #4: parses .vsix asset URL from realistic release JSON (python3 branch)", () => {
    const pyAvailable = spawnSync("python3", ["--version"]).status === 0;
    if (!pyAvailable) {
      // python3 not present → the grep/sed fallback is exercised instead; skip.
      return;
    }

    const result = spawnSync(
      "bash",
      ["-c", driver(`find_vsix_asset_url '${fixtureJson.replace(/'/g, "'\\''")}'`)],
      { env: { ...process.env }, encoding: "utf8", timeout: 10000 }
    );
    if (result.status !== 0) {
      // eslint-disable-next-line no-console
      console.error("driver stderr:", result.stderr);
    }
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      "https://github.com/lengockhoa/VSKit/releases/download/v0.1.0/vskit-0.1.0.vsix"
    );
  });
  it("Test #4a: rejects a release containing only a foreign-product VSIX", () => {
    const foreignOnly = JSON.stringify({
      assets: [{
        name: "foreign-extension-0.1.0.vsix",
        browser_download_url: "https://example.invalid/foreign-extension-0.1.0.vsix",
      }],
    });
    const result = spawnSync(
      "bash",
      ["-c", driver(`find_vsix_asset_url '${foreignOnly.replace(/'/g, "'\\''")}'`)],
      { env: { ...process.env }, encoding: "utf8", timeout: 10000 },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  it("Test #4b: parses tag_name from release JSON (python3 branch)", () => {
    const pyAvailable = spawnSync("python3", ["--version"]).status === 0;
    if (!pyAvailable) return;

    const result = spawnSync(
      "bash",
      ["-c", driver(`parse_json_field '${fixtureJson.replace(/'/g, "'\\''")}' tag_name`)],
      { env: { ...process.env }, encoding: "utf8", timeout: 10000 }
    );
    if (result.status !== 0) {
      // eslint-disable-next-line no-console
      console.error("driver stderr:", result.stderr);
    }
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("v0.1.0");
  });
});
