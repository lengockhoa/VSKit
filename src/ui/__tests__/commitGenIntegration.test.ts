import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGenerateCommitMessage, TOAST_NO_LITE, TOAST_NO_CHANGES, ACTION_OPEN_SETTINGS, TOAST_GENERATION_IN_PROGRESS, type CommitGenDeps } from "../../ai/commitGenCommand";
import { sanitizeCommitMessage, COMMIT_SUBJECT_MAX_CHARS } from "../../ai/commitMessage";
import type { AiSettings, AiConfig } from "../../ai/settings";
import type { ProviderRequest, ProviderResult } from "../../ai/provider";
import type { OmpDetection } from "../../ai/omp/detect";

const COMMAND_ID = "VSKit.generateCommitMessage";
const settings: AiSettings = {
  baseUrl: "https://example.test/v1", method: "chat/completions", timeoutMs: 10_000, maxSteps: 1,
  models: { work: { modelId: "work", vision: false }, smart: { modelId: "smart", vision: false }, autocomplete: { modelId: "", vision: false }, lite: { modelId: "lite", vision: false } },
  engine: "builtin",
};
const config: AiConfig = { ...settings, apiKey: "secret" };
const result = (text: string): ProviderResult => ({ text, toolCalls: [], finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0 } });
const diff = { repoName: "VSKit", branch: "main", files: ["src/a.ts"], diffText: "+change" };
function deps(overrides: Partial<CommitGenDeps> = {}): CommitGenDeps {
  return {
    loadSettings: async () => settings, loadConfig: async () => config,
    detectOmp: async () => ({ available: true, ok: true, path: "/bin/omp" } as OmpDetection),
    resolveEngine: () => ({ engine: "omp", requiresConfig: false, path: "/bin/omp" }),
    buildOmpPrintPort: async () => ({ complete: async () => "feat: omp message" }),
    builtinComplete: async (_cfg: AiConfig, _req: ProviderRequest) => result("feat: builtin message"),
    collectDiff: async () => diff, setInputBox: vi.fn(), showInfo: vi.fn(), showError: vi.fn(),
    showSettingsToast: vi.fn(async () => undefined), openSettings: vi.fn(), ...overrides,
  };
}

describe("Generate Commit Message integration contract", () => {
  it("preserves command identifier, title, category, icon, and SCM menu wiring", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    const command = manifest.contributes.commands.find((entry: Record<string, unknown>) => entry.command === COMMAND_ID);
    expect(command).toEqual({ command: COMMAND_ID, title: "VSKit: Generate Commit Message", category: "VSKit", icon: "$(edit)" });
    const menu = manifest.contributes.menus["scm/title"].find((entry: Record<string, unknown>) => entry.command === COMMAND_ID);
    expect(menu).toMatchObject({ group: "navigation", when: "scmProvider == git" });
  });

  it("uses builtin-direct whenever backend config exists, regardless of engine selection", async () => {
    const builtinComplete = vi.fn(async () => result("```\nfeat(db): add index\n```"));
    const buildOmpPrintPort = vi.fn();
    const trace: string[] = [];
    const setInputBox = vi.fn();
    await runGenerateCommitMessage(deps({ builtinComplete, buildOmpPrintPort, setInputBox, trace: { correlationId: "integration", emit: (event, metadata) => { if (event === "route.selected") trace.push(String(metadata?.route)); } } }));
    expect(builtinComplete).toHaveBeenCalledOnce();
    expect(buildOmpPrintPort).not.toHaveBeenCalled();
    expect(trace).toEqual(["builtin-direct"]);
    expect(setInputBox).toHaveBeenCalledWith("feat(db): add index");
  });

  it("uses omp-print only without backend config", async () => {
    const complete = vi.fn(async () => "feat: fallback");
    const builtinComplete = vi.fn();
    const trace: string[] = [];
    const port = vi.fn(async () => ({ complete }));
    await runGenerateCommitMessage(deps({ loadConfig: async () => null, buildOmpPrintPort: port, builtinComplete, trace: { correlationId: "integration", emit: (event, metadata) => { if (event === "route.selected") trace.push(String(metadata?.route)); } } }));
    expect(port).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(builtinComplete).not.toHaveBeenCalled();
    expect(trace).toEqual(["omp-print"]);
  });

  it("shows frozen disabled-lite settings action before collecting diff", async () => {
    const modelSettings = { ...settings, models: { ...settings.models, lite: { modelId: "", vision: false } } } as AiSettings;
    const showSettingsToast = vi.fn(async () => ACTION_OPEN_SETTINGS);
    const openSettings = vi.fn();
    const collectDiff = vi.fn(async () => diff);
    await runGenerateCommitMessage(deps({ loadSettings: async () => modelSettings, showSettingsToast, openSettings, collectDiff }));
    expect(showSettingsToast).toHaveBeenCalledWith(TOAST_NO_LITE, ACTION_OPEN_SETTINGS);
    expect(openSettings).toHaveBeenCalledOnce();
    expect(collectDiff).not.toHaveBeenCalled();
  });

  it("cuts off on empty diff and never calls model", async () => {
    const showError = vi.fn();
    const builtinComplete = vi.fn();
    const buildOmpPrintPort = vi.fn();
    await runGenerateCommitMessage(deps({ collectDiff: async () => null, showError, builtinComplete, buildOmpPrintPort }));
    expect(showError).toHaveBeenCalledWith(TOAST_NO_CHANGES);
    expect(builtinComplete).not.toHaveBeenCalled();
    expect(buildOmpPrintPort).not.toHaveBeenCalled();
  });

  it("sanitizes a fenced subject to the 72-character boundary", () => {
    const output = sanitizeCommitMessage("```text\n" + "x".repeat(90) + "\n```");
    expect(output).toHaveLength(COMMIT_SUBJECT_MAX_CHARS);
    expect(output).not.toContain("```");
    expect(output).not.toContain("body");
  });

  it("retains the command's single-flight gate before progress/model work", () => {
    const source = readFileSync(resolve(process.cwd(), "src/extension.ts"), "utf8");
    const commandAt = source.indexOf(`"${COMMAND_ID}"`, source.indexOf("export async function activate"));
    const progressAt = source.indexOf("withProgress(", commandAt);
    const gateAt = source.indexOf("commitGenGate.acquire()", commandAt);
    const toastAt = source.indexOf("TOAST_GENERATION_IN_PROGRESS", commandAt);
    const literalToast = readFileSync(resolve(process.cwd(), "src/ai/commitGenCommand.ts"), "utf8");
    expect(literalToast).toContain(TOAST_GENERATION_IN_PROGRESS);
    expect(commandAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(commandAt);
    expect(toastAt).toBeGreaterThan(gateAt);
    expect(progressAt).toBeGreaterThan(toastAt);
    expect(source.slice(commandAt, progressAt)).toContain("TOAST_GENERATION_IN_PROGRESS");
  });
});
