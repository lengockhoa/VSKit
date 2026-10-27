// src/ai/commitGenCommand.ts — TASK-GC-007
//
// Pure orchestration behind the SCM sparkle: collect the diff (GC-002),
// resolve the Lite Model, generate the message (GC-003 via builtin provider
// or omp print mode), and inject the sanitized text
// into `repository.inputBox.value`. Every vscode interaction is a port —
// this module never imports `vscode`. Privacy invariant: apiKey /
// credentials never appear in any prompt or log line.
//
// Frozen strings (PLAN §1): see TOAST_NO_LITE / TOAST_NO_CHANGES /
// TOAST_NO_BACKEND_CONFIG / ERROR_OMP_UNAVAILABLE.
import type { AiSettings, AiConfig, AiEngine } from "./settings";
import type { AgentDetections, EngineChoice } from "./engineChoice";
import type { OmpDetection } from "./omp/detect";
import type {
  ChatMessage,
  ProviderRequest,
  ProviderResult,
  ProviderTrace,
} from "./provider";
import {
  buildCommitPrompt,
  sanitizeCommitMessage,
  serializeCommitPrompt,
} from "./commitMessage";
import type { CommitGenOmpPrintPort } from "./commitGenOmpPrint";
import {
  checkCommitMessage,
  type CommitMessageIssue,
} from "./commitMessageGuard";

// ---- frozen strings ---------------------------------------------------------
export const TOAST_NO_LITE =
  "Configure the Lite Model in VSKit AI Settings to use Generate Commit Message";
export const ACTION_OPEN_SETTINGS = "Open Settings";
export const TOAST_NO_CHANGES =
  "VSKit: nothing to commit — this Git repo has no staged or unstaged changes. Stage or modify at least one file, then click again.";
export const TOAST_DIFF_CHANGED =
  "VSKit: repository changes changed while the commit message was being generated — review the current diff and try again.";
export const TOAST_INPUT_CHANGED =
  "VSKit: commit message was not inserted because the SCM input changed while generation was running.";
export const TOAST_NO_BACKEND_CONFIG =
  "Configure the AI backend (base URL + API key) in VSKit AI Settings";
export const ERROR_ENGINE_UNAVAILABLE_PREFIX = "VSKit: ";
export const ERROR_ENGINE_UNAVAILABLE_SUFFIX = " engine unavailable — ";
export const ERROR_OMP_UNAVAILABLE_PREFIX = "VSKit: omp engine unavailable — ";
export const ERROR_NON_STRING_TEXT_BUILTIN =
  "commit-gen: builtin provider returned non-string text";
export const ERROR_NON_STRING_TEXT_OMP =
  "commit-gen: omp one-shot returned non-string";

// Guard-flow frozen strings. Error messages expose rejection reasons, never raw output.
export const ERROR_COMMIT_GUARD_FAILED_PREFIX =
  "VSKit: generated commit message failed validation";
export const ERROR_COMMIT_GUARD_RETRY_NOTE =
  "Nothing was injected into the commit box.";

// Progress/cancel frozen strings (SPEC FR-002 / §8.2). Stage text is reported
// through `deps.report`; the in-progress toast is shown by the host when the
// single-flight gate refuses a second run.
export const COMMIT_GEN_TIMEOUT_MS = 120_000;
export const TOAST_GENERATION_IN_PROGRESS =
  "VSKit: a commit message is already being generated — wait for it to finish or cancel it.";
export const PROGRESS_COLLECTING_DIFF = "Collecting diff…";
export const PROGRESS_CONTACTING_MODEL = "Contacting model…";
export const PROGRESS_VALIDATING = "Validating message…";

// ---- single-attempt guard orchestration --------------------------------------
/** Outcome of the one-call sanitize → guard pipeline. */
export type GuardOutcome =
  | { ok: true; message: string }
  | { ok: false; kind: "empty"; raw: string }
  | {
      ok: false;
      kind: "invalid";
      raw: string;
      message: string;
      reasons: readonly CommitMessageIssue[];
    };

/** Single model call per click; transport errors retain the branch catch behavior. */
export async function generateWithGuard(
  call: (messages: readonly ChatMessage[]) => Promise<string>,
  prompt: readonly ChatMessage[],
  trace?: CommitGenTrace,
): Promise<GuardOutcome> {
  const raw = await call(prompt);
  const guardStartedAt = trace ? performance.now() : 0;
  const message = sanitizeCommitMessage(raw);
  const check = checkCommitMessage(message);
  trace?.emit("guard.attempt.complete", {
    attempt: 1,
    outcome: check.ok ? "passed" : message.length === 0 ? "empty" : "rejected",
    durationMs: traceElapsed(guardStartedAt),
    messageChars: message.length,
  });
  if (check.ok) return { ok: true, message };
  if (message.length === 0) return { ok: false, kind: "empty", raw };
  return { ok: false, kind: "invalid", raw, message, reasons: check.reasons };
}

// ---- structural types -------------------------------------------------------

/** Structural subset of the GC-002 `CommitDiffInput` used by the prompt
 * builder. Keeps this module's imports stable and lets unit tests pass a
 * minimum-shape fake. */
export interface CommitDiffInputLike {
  repoName: string;
  branch?: string;
  files: readonly string[];
  diffText: string;
  scope?: "staged" | "unstaged";
  diffFingerprint?: string;
}

export type CommitGenTraceValue = string | number | boolean | null;

export interface CommitGenTrace {
  readonly correlationId: string;
  emit(event: string, metadata?: Readonly<Record<string, CommitGenTraceValue>>): void;
}

// ---- injected ports ---------------------------------------------------------

export interface CommitGenDeps {
  /** Settings without apiKey. null ⇒ feature disabled or store empty. */
  loadSettings(): Promise<AiSettings | null>;
  /** Full config (settings + apiKey). null when EITHER store is empty. */
  loadConfig(): Promise<AiConfig | null>;
  /** Detect the local `omp` binary / version. */
  detectOmp(): Promise<OmpDetection>;
  /** Pure engine-resolution policy (GC-001 / engineChoice.ts). */
  resolveEngine(input: {
    engine?: unknown;
    detections?: AgentDetections;
    detection?: OmpDetection;
    config: unknown | null;
  }): EngineChoice;
  /** Build a one-shot omp print-mode port with the selected Lite model. */
  buildOmpPrintPort(choice: EngineChoice, modelId: string): Promise<CommitGenOmpPrintPort>;
  /** Provider-port for the builtin path. Mirrors `createProviderClient(...).complete`. */
  builtinComplete(
    cfg: AiConfig,
    req: ProviderRequest,
    trace?: ProviderTrace,
  ): Promise<ProviderResult>;
  /** GC-002 collection port. null ⇒ no changes to summarize. */
  collectDiff(): Promise<CommitDiffInputLike | null>;
  /** Check that the originally selected diff still matches the repository. */
  validateDiffFresh?(diff: CommitDiffInputLike): Promise<boolean>;
  /** Check that the user has not edited the SCM input since generation began. */
  isInputUnchanged?(): boolean;
  /** Offer the completed result when the user edits SCM input during generation. */
  showInputChanged?(message: string, result: string): Promise<boolean>;
  /** Copy the result only after the user explicitly asks for it. */
  copyToClipboard?(message: string): Promise<void>;
  /** Inject the generated message into the SCM input box. */
  setInputBox(message: string): void;
  /** Light info toast. */
  showInfo(m: string): void;
  /** Error toast. */
  showError(m: string): void;
  /** Settings toast with a single action button. Returns the chosen action
   *  label (the same string passed in) or undefined if dismissed. */
  showSettingsToast(m: string, action: string): Promise<string | undefined>;
  /** Open the AI Settings panel — invoked when the user picks the action. */
  openSettings(): void;
  /** Progress stage reporter (SPEC FR-002). Receives the frozen
   *  `PROGRESS_*` strings; absent ⇒ stages are skipped. */
  report?(message: string): void;
  /** Opt-in, metadata-only measurements. Undefined in normal runs. */
  trace?: CommitGenTrace;
  /** Cancellation poll (SPEC FR-002). Checked at the post-diff and
   *  post-outcome checkpoints; `true` ⇒ silent return (no toast, no
   *  injection). */
  isCancelled?(): boolean;
  /** Cancellation signal forwarded onto `ProviderRequest.signal` so a
   *  cancel reaches the in-flight fetch (SPEC FR-003). The host wires it
   *  from the progress token via an AbortController. */
  signal?: AbortSignal;
}

// ---- main entry -------------------------------------------------------------
/**
 * Run the Generate Commit Message flow. Pure / single-shot — no global
 * state. The host (`src/extension.ts`) supplies real vscode-backed deps;
 * tests inject fakes.
 *
 * Routing is independent of shared chat settings: configured backend uses the
 * builtin provider directly; otherwise an available omp uses print mode. Each
 * click makes one model call, validates the returned subject, then injects only
 * on success.
 */
function traceElapsed(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

function messageCharacters(messages: readonly ChatMessage[]): number {
  let characters = 0;
  for (const message of messages) {
    if (typeof message.content === "string") {
      characters += message.content.length;
    } else {
      for (const part of message.content) {
        if (typeof part.text === "string") characters += part.text.length;
      }
    }
  }
  return characters;
}
async function callBuiltinWithTrace(
  deps: CommitGenDeps,
  cfg: AiConfig,
  request: ProviderRequest,
  attempt: number,
  engine: AiEngine,
): Promise<ProviderResult> {
  const trace = deps.trace;
  const startedAt = trace ? performance.now() : 0;
  const requestId = trace
    ? `${trace.correlationId}/request-${attempt}`
    : undefined;
  if (trace) {
    trace.emit("engine.request.start", {
      engine,
      attempt,
      requestId: requestId ?? "",
      modelId: request.modelId,
      method: cfg.method,
      maxOutputTokens: request.maxOutputTokens ?? null,
      temperature: request.temperature ?? null,
      promptChars: messageCharacters(request.messages),
      firstTextObservable: false,
    });
  }
  try {
    const providerTrace: ProviderTrace | undefined =
      trace && requestId
        ? {
            requestId,
            emit: (event, metadata = {}) =>
              trace.emit(event, metadata),
          }
        : undefined;
    const result = await deps.builtinComplete(cfg, request, providerTrace);
    if (trace) {
      trace.emit("engine.request.complete", {
        engine,
        attempt,
        requestId: requestId ?? "",
        durationMs: traceElapsed(startedAt),
        outputChars: result.text.length,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
    }
    return result;
  } catch (error) {
    if (trace) {
      trace.emit("engine.request.error", {
        engine,
        attempt,
        requestId: requestId ?? "",
        durationMs: traceElapsed(startedAt),
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
    throw error;
  }
}
async function handleChangedScmInput(
  deps: CommitGenDeps,
  message: string,
): Promise<void> {
  deps.trace?.emit("scm.input.not_updated", { reason: "input_changed" });
  if (!deps.showInputChanged) {
    deps.showInfo(TOAST_INPUT_CHANGED);
    return;
  }
  const copy = await deps.showInputChanged(TOAST_INPUT_CHANGED, message);
  if (!copy) return;
  await deps.copyToClipboard?.(message);
  deps.trace?.emit("scm.input.copy_completed", { copied: true });
}

export async function runGenerateCommitMessage(deps: CommitGenDeps): Promise<void> {
  // 1. Lite model must be configured.
  const settingsStartedAt = deps.trace ? performance.now() : 0;
  const settings = await deps.loadSettings();
  if (deps.trace) {
    deps.trace.emit("settings.complete", {
      durationMs: traceElapsed(settingsStartedAt),
      configured: Boolean(settings?.models?.lite?.modelId?.trim()),
    });
  }
  const lite = settings?.models?.lite;
  if (!settings || !lite || !lite.modelId || lite.modelId.trim() === "") {
    const action = await deps.showSettingsToast(TOAST_NO_LITE, ACTION_OPEN_SETTINGS);
    if (action === ACTION_OPEN_SETTINGS) {
      deps.openSettings();
    }
    return;
  }

  // 2. Diff must exist.
  deps.report?.(PROGRESS_COLLECTING_DIFF);
  const diffStartedAt = deps.trace ? performance.now() : 0;
  const diff = await deps.collectDiff();
  if (deps.trace) {
    deps.trace.emit("diff.complete", {
      durationMs: traceElapsed(diffStartedAt),
      hasChanges: diff !== null,
      ...(diff ? { fileCount: diff.files.length, diffChars: diff.diffText.length } : {}),
    });
  }
  if (diff === null) {
    deps.showError(TOAST_NO_CHANGES);
    return;
  }
  // Cancel checkpoint (SPEC FR-002): a cancel that landed while the diff was
  // being collected closes the flow silently — no engine call, no toast.
  if (deps.isCancelled?.()) {
    return;
  }

  // Construct the one-shot prompt after the selected repository diff is known.
  const promptStartedAt = deps.trace ? performance.now() : 0;
  const prompt = buildCommitPrompt({
    repoName: diff.repoName,
    ...(diff.branch !== undefined ? { branch: diff.branch } : {}),
    files: diff.files,
    diffText: diff.diffText,
  });
  if (deps.trace) {
    deps.trace.emit("prompt.complete", {
      durationMs: traceElapsed(promptStartedAt),
      messageCount: prompt.length,
      promptChars: messageCharacters(prompt),
      fileCount: diff.files.length,
      diffChars: diff.diffText.length,
    });
  }
  let outcome: GuardOutcome | null = null;
  const selectedEngine: AiEngine = settings.engine;
  const configStartedAt = deps.trace ? performance.now() : 0;
  const cfg = await deps.loadConfig();
  deps.trace?.emit("config.complete", {
    durationMs: traceElapsed(configStartedAt),
    configured: cfg !== null,
  });
  deps.report?.(PROGRESS_CONTACTING_MODEL);
  const requestSignal: AbortSignal = deps.signal ?? new AbortController().signal;

  const runBuiltin = async (choice?: EngineChoice): Promise<boolean> => {
    if (cfg === null) return false;
    deps.trace?.emit("route.selected", {
      route: "builtin-direct",
      reason: "backend_configured",
      settingsEngine: selectedEngine,
    });
    try {
      outcome = await generateWithGuard(async (messages) => {
        const result = await callBuiltinWithTrace(deps, cfg, {
          modelId: lite.modelId,
          messages: [...messages],
          maxOutputTokens: 300,
          temperature: 0.2,
          signal: requestSignal,
        }, 1, selectedEngine);
        if (typeof result.text !== "string") throw new Error(ERROR_NON_STRING_TEXT_BUILTIN);
        if (choice?.hint && (selectedEngine === "claude-code" || selectedEngine === "codex")) {
          deps.showError(`${ERROR_ENGINE_UNAVAILABLE_PREFIX}${selectedEngine}${ERROR_ENGINE_UNAVAILABLE_SUFFIX}${choice.hint}`);
        }
        return result.text;
      }, prompt, deps.trace);
      return true;
    } catch (error) {
      if (deps.isCancelled?.()) return true;
      const err = error as Error & { bodySnippet?: string };
      const detail = err.bodySnippet ? `: ${err.bodySnippet}` : "";
      deps.showError(`VSKit: provider error — ${err.message ?? String(error)}${detail}`);
      return true;
    }
  };

  if (cfg !== null) {
    let choice: EngineChoice | undefined;
    if (selectedEngine === "claude-code" || selectedEngine === "codex") {
      choice = deps.resolveEngine({ engine: selectedEngine, detections: {}, config: cfg });
    }
    await runBuiltin(choice);
  } else {
    const detectionStartedAt = deps.trace ? performance.now() : 0;
    const detection = await deps.detectOmp();
    deps.trace?.emit("omp.detect.complete", {
      durationMs: traceElapsed(detectionStartedAt),
      available: detection.ok,
      ...(detection.version ? { version: detection.version } : {}),
    });
    const choice = deps.resolveEngine({ engine: selectedEngine, detection, config: null });
    if (choice.engine !== "omp") {
      deps.trace?.emit("route.selected", {
        route: "unavailable",
        reason: "no_backend_config",
        settingsEngine: selectedEngine,
      });
      if (selectedEngine === "omp") {
        deps.showError(`${ERROR_OMP_UNAVAILABLE_PREFIX}${choice.hint ?? "install omp"}`);
      } else {
        const action = await deps.showSettingsToast(TOAST_NO_BACKEND_CONFIG, ACTION_OPEN_SETTINGS);
        if (action === ACTION_OPEN_SETTINGS) deps.openSettings();
      }
      return;
    }
    deps.trace?.emit("route.selected", {
      route: "omp-print",
      reason: "no_backend_config",
      settingsEngine: selectedEngine,
    });
    const setupStartedAt = deps.trace ? performance.now() : 0;
    let port: CommitGenOmpPrintPort;
    try {
      port = await deps.buildOmpPrintPort(choice, lite.modelId);
      deps.trace?.emit("omp.setup.complete", { durationMs: traceElapsed(setupStartedAt), success: true });
    } catch (error) {
      deps.trace?.emit("omp.setup.error", {
        durationMs: traceElapsed(setupStartedAt),
        errorName: error instanceof Error ? error.name : typeof error,
      });
      deps.trace?.emit("omp.setup.complete", { durationMs: traceElapsed(setupStartedAt), success: false });
      deps.showError(`VSKit: omp error — ${(error as Error).message ?? String(error)}`);
      return;
    }
    if (deps.isCancelled?.()) return;
    const serializedPrompt = serializeCommitPrompt(prompt);
    const requestStartedAt = deps.trace ? performance.now() : 0;
    deps.trace?.emit("engine.request.start", {
      engine: "omp-print",
      attempt: 1,
      promptChars: serializedPrompt.length,
      firstTextObservable: true,
    });
    let firstTextReported = false;
    const onFirstText = () => {
      if (firstTextReported) return;
      firstTextReported = true;
      deps.trace?.emit("engine.first_text", {
        engine: "omp-print",
        attempt: 1,
        elapsedMs: traceElapsed(requestStartedAt),
      });
    };
    try {
      outcome = await generateWithGuard(async () => {
        try {
          const raw: unknown = await port.complete(serializedPrompt, onFirstText);
          if (typeof raw !== "string") throw new Error(ERROR_NON_STRING_TEXT_OMP);
          deps.trace?.emit("engine.request.complete", {
            engine: "omp-print",
            attempt: 1,
            durationMs: traceElapsed(requestStartedAt),
            outputChars: raw.length,
            firstTextObservable: true,
          });
          return raw;
        } catch (error) {
          deps.trace?.emit("engine.request.error", {
            engine: "omp-print",
            attempt: 1,
            durationMs: traceElapsed(requestStartedAt),
            errorName: error instanceof Error ? error.name : typeof error,
          });
          throw error;
        }
      }, prompt, deps.trace);
    } catch (error) {
      if (deps.isCancelled?.()) return;
      deps.showError(`VSKit: omp error — ${(error as Error).message ?? String(error)}`);
      return;
    }
  }

  // 4. Guard verdict. `outcome` is always set: every branch either returns
  // early on error or assigns it above.
  deps.report?.(PROGRESS_VALIDATING);
  // Post-outcome cancel checkpoint (SPEC FR-002): a cancel that landed while
  // the engine ran closes silently — no injection, no toast — even when usable.
  if (deps.isCancelled?.()) {
    return;
  }
  const guardStartedAt = deps.trace ? performance.now() : 0;
  if (outcome !== null && outcome.ok) {
    if (deps.trace) {
      deps.trace.emit("guard.passed", {
        durationMs: traceElapsed(guardStartedAt),
        messageChars: outcome.message.length,
      });
    }
    let diffIsCurrent = true;
    if (deps.validateDiffFresh) {
      const freshnessStartedAt = deps.trace ? performance.now() : 0;
      diffIsCurrent = await deps.validateDiffFresh(diff);
      deps.trace?.emit("diff.freshness.complete", {
        durationMs: traceElapsed(freshnessStartedAt),
        current: diffIsCurrent,
      });
      if (deps.isCancelled?.()) return;
    }
    // This is deliberately the last asynchronous-boundary check before a write.
    if (deps.isInputUnchanged && !deps.isInputUnchanged()) {
      await handleChangedScmInput(deps, outcome.message);
      return;
    }
    if (!diffIsCurrent) {
      deps.trace?.emit("scm.input.not_updated", { reason: "diff_changed" });
      deps.showInfo(TOAST_DIFF_CHANGED);
      return;
    }
    deps.setInputBox(outcome.message);
    return;
  }
  if (outcome !== null && outcome.kind === "invalid") {
    if (deps.trace) {
      deps.trace.emit("guard.rejected", {
        reasons: outcome.reasons.join(","),
      });
    }
    // Non-empty, guard-rejected. Surface only rejection metadata; never
    // persist or display provider response text. Do NOT touch the input box.
    deps.showError(
      `${ERROR_COMMIT_GUARD_FAILED_PREFIX} (reasons: ${outcome.reasons.join(", ")}). ` +
        ERROR_COMMIT_GUARD_RETRY_NOTE,
    );
    return;
  }

  // Empty: preserve the generic diagnostic while keeping
  // provider response text out of logs, files, and notifications.
  const rawLen = outcome !== null ? outcome.raw.length : 0;
  if (deps.trace) {
    deps.trace.emit("guard.empty", { rawChars: rawLen });
  }
  deps.showError(
    `VSKit: provider returned no commit message text (raw length ${rawLen}). ` +
      "Check Lite Model config.",
  );
}
