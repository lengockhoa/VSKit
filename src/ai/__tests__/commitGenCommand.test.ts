import { describe, expect, it, vi } from "vitest";
import { runGenerateCommitMessage, COMMIT_GEN_TIMEOUT_MS, PROGRESS_COLLECTING_DIFF, PROGRESS_CONTACTING_MODEL, PROGRESS_VALIDATING, type CommitGenDeps, type CommitDiffInputLike } from "../commitGenCommand";
import type { AiConfig, AiSettings } from "../settings";
import type { ProviderRequest, ProviderResult } from "../provider";
import type { OmpDetection } from "../omp/detect";
import type { EngineChoice } from "../engineChoice";

const settings: AiSettings = {
  baseUrl: "https://example.test/v1", method: "chat/completions", timeoutMs: 10_000, maxSteps: 1,
  models: { work: { modelId: "work", vision: false }, smart: { modelId: "smart", vision: false }, autocomplete: { modelId: "", vision: false }, lite: { modelId: "lite", vision: false } },
  engine: "builtin",
};
const config: AiConfig = { ...settings, apiKey: "secret-key" };
const diff: CommitDiffInputLike = { repoName: "VSKit", files: ["src/a.ts"], diffText: "+change" };
const providerResult = (text: string): ProviderResult => ({ text, toolCalls: [], finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0 } });
function makeDeps(overrides: Partial<CommitGenDeps> = {}): CommitGenDeps {
  return {
    loadSettings: async () => settings,
    loadConfig: async () => config,
    detectOmp: async () => ({ available: true, ok: true, path: "/bin/omp" } as OmpDetection),
    resolveEngine: () => ({ engine: "omp", requiresConfig: false, path: "/bin/omp" } as EngineChoice),
    buildOmpPrintPort: async () => ({ complete: async () => "feat: add change" }),
    builtinComplete: async (_cfg: AiConfig, _req: ProviderRequest) => providerResult("feat: add change"),
    collectDiff: async () => diff,
    setInputBox: vi.fn(), showInfo: vi.fn(), showError: vi.fn(),
    showSettingsToast: vi.fn(async () => undefined), openSettings: vi.fn(),
    ...overrides,
  };
}

describe("runGenerateCommitMessage", () => {
  it("uses configured backend directly and makes exactly one call", async () => {
    const builtinComplete = vi.fn(async () => providerResult("```text\n\"- feat: add change\"\nbody\n```"));
    const buildOmpPrintPort = vi.fn(async () => ({ complete: async () => "wrong route" }));
    const setInputBox = vi.fn();
    await runGenerateCommitMessage(makeDeps({ builtinComplete, buildOmpPrintPort, setInputBox }));
    expect(builtinComplete).toHaveBeenCalledOnce();
    expect(builtinComplete.mock.calls[0][1].modelId).toBe("lite");
    expect(buildOmpPrintPort).not.toHaveBeenCalled();
    expect(setInputBox).toHaveBeenCalledWith("feat: add change");
  });

  it("uses omp print mode only when backend config is absent", async () => {
    const complete = vi.fn(async () => "feat: omp fallback");
    const buildOmpPrintPort = vi.fn(async () => ({ complete }));
    const builtinComplete = vi.fn(async () => providerResult("wrong route"));
    const traceEvents: Array<[string, Readonly<Record<string, unknown>> | undefined]> = [];
    const deps = makeDeps({ loadConfig: async () => null, buildOmpPrintPort, builtinComplete, trace: { correlationId: "test", emit: (e, m) => traceEvents.push([e, m]) } });
    await runGenerateCommitMessage(deps);
    expect(buildOmpPrintPort).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0][0]).toContain("+change");
    expect(builtinComplete).not.toHaveBeenCalled();
    expect(traceEvents).toContainEqual(["route.selected", expect.objectContaining({ route: "omp-print" })]);
  });

  it("does not retry rejected garbage", async () => {
    const builtinComplete = vi.fn(async () => providerResult("a".repeat(50)));
    const setInputBox = vi.fn();
    const showError = vi.fn();
    await runGenerateCommitMessage(makeDeps({ builtinComplete, setInputBox, showError }));
    expect(builtinComplete).toHaveBeenCalledOnce();
    expect(setInputBox).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledOnce();
    expect(showError.mock.calls[0][0]).toContain("unbroken-blob");
    expect(showError.mock.calls[0][0]).not.toContain("a".repeat(50));
  });

  it("shows settings prompt when no backend config and omp unavailable", async () => {
    const showSettingsToast = vi.fn(async () => undefined);
    const buildOmpPrintPort = vi.fn();
    await runGenerateCommitMessage(makeDeps({ loadConfig: async () => null, detectOmp: async () => ({ available: false, ok: false, reason: "not-installed" }), resolveEngine: () => ({ engine: "builtin", requiresConfig: true }), buildOmpPrintPort, showSettingsToast }));
    expect(showSettingsToast).toHaveBeenCalledOnce();
    expect(buildOmpPrintPort).not.toHaveBeenCalled();
  });

  it("handles empty diff and missing lite model without calling a model", async () => {
    const builtinComplete = vi.fn();
    const showError = vi.fn();
    await runGenerateCommitMessage(makeDeps({ collectDiff: async () => null, builtinComplete, showError }));
    expect(builtinComplete).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledOnce();
    const noLite = { ...settings, models: { ...settings.models, lite: { modelId: "", vision: false } } } as AiSettings;
    const collectDiff = vi.fn(async () => diff);
    await runGenerateCommitMessage(makeDeps({ loadSettings: async () => noLite, collectDiff, builtinComplete }));
    expect(collectDiff).not.toHaveBeenCalled();
    expect(builtinComplete).not.toHaveBeenCalled();
  });

  it("preserves provider errors and never injects on transport failure", async () => {
    const setInputBox = vi.fn();
    const showError = vi.fn();
    await runGenerateCommitMessage(makeDeps({ builtinComplete: async () => { throw new Error("network failure"); }, setInputBox, showError }));
    expect(showError.mock.calls[0][0]).toContain("network failure");
    expect(setInputBox).not.toHaveBeenCalled();
  });

  it("reports the expected progress stages", async () => {
    const report = vi.fn();
    await runGenerateCommitMessage(makeDeps({ report }));
    expect(report.mock.calls.map(([message]) => message)).toEqual([PROGRESS_COLLECTING_DIFF, PROGRESS_CONTACTING_MODEL, PROGRESS_VALIDATING]);
  });

  it("keeps the flow timeout constant", () => {
    expect(COMMIT_GEN_TIMEOUT_MS).toBe(120_000);
  });
});
