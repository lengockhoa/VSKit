// src/ai/commitGenCommand.ts — TASK-GC-007
//
// Pure orchestration behind the SCM sparkle: collect the diff (GC-002),
// resolve the Lite Model + engine (GC-001), generate the message (GC-003
// via builtin provider or omp one-shot), and inject the sanitized text
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
  buildRetryCommitPrompt,
  sanitizeCommitMessage,
  serializeCommitPrompt,
} from "./commitMessage";
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

// Guard-flow frozen strings (SPEC §8.5). Error messages expose rejection reasons, never raw output.
export const ERROR_COMMIT_GUARD_FAILED_PREFIX =
  "VSKit: generated commit message failed validation";
export const ERROR_COMMIT_GUARD_RETRY_NOTE =
  "Retried once and still invalid — nothing was injected into the commit box.";

// Progress/cancel frozen strings (SPEC FR-002 / §8.2). Stage text is reported
// through `deps.report`; the in-progress toast is shown by the host when the
// single-flight gate refuses a second run.
export const COMMIT_GEN_TIMEOUT_MS = 120_000;
export const TOAST_GENERATION_IN_PROGRESS =
  "VSKit: a commit message is already being generated — wait for it to finish or cancel it.";
export const PROGRESS_COLLECTING_DIFF = "Collecting diff…";
export const PROGRESS_CONTACTING_MODEL = "Contacting model…";
export const PROGRESS_VALIDATING = "Validating message…";
export const PROGRESS_RETRYING = "Retrying with corrective prompt…";

// ---- guard + retry-1 orchestration (SPEC §8.4) ------------------------------
/**
 * Outcome of the sanitize → guard → (retry once) pipeline.
 *
 * - `ok`               — a sanitized, guard-approved message is ready to inject.
 * - `kind: "empty"`    — the model produced no usable text (after sanitize).
 *                        NEVER retried: the caller keeps the existing empty
 *                        diagnostic and dump. `raw` is the offending raw text.
 * - `kind: "invalid"`  — non-empty but guard-rejected twice. The caller shows
 *                        the frozen §8.5 toast and does NOT inject.
 */
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

/**
 * Run the sanitize → guard pipeline with at most one corrective retry.
 *
 * Pure: touches no ports and never imports `vscode`. `call` is a per-branch
 * closure that performs one engine request for the given messages — any throw
 * (transport, non-string payload) propagates to the caller's existing catch so
 * the branch-specific error mapping is preserved. An empty sanitized message is
 * never retried (SPEC FR-007); a non-empty guard failure triggers exactly one
 * retry through `buildRetryCommitPrompt(prompt, message, reasons)`.
 */
export async function generateWithGuard(
  call: (messages: readonly ChatMessage[]) => Promise<string>,
  prompt: readonly ChatMessage[],
): Promise<GuardOutcome> {
  const raw = await call(prompt);
  const message = sanitizeCommitMessage(raw);
  const first = checkCommitMessage(message);
  if (first.ok) {
    return { ok: true, message };
  }
  if (message.length === 0) {
    // Empty (whitespace-only / stripped) — no retry.
    return { ok: false, kind: "empty", raw };
  }

  const retryPrompt = buildRetryCommitPrompt(prompt, message, first.reasons);
  const raw2 = await call(retryPrompt);
  const message2 = sanitizeCommitMessage(raw2);
  const second = checkCommitMessage(message2);
  if (second.ok) {
    return { ok: true, message: message2 };
  }
  if (message2.length === 0) {
    return { ok: false, kind: "empty", raw: raw2 };
  }
  return {
    ok: false,
    kind: "invalid",
    raw: raw2,
    message: message2,
    reasons: second.reasons,
  };
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

/** One-shot omp chat engine. The host wires this from `createOmpChatEngine`
 * (src/ai/omp/ompChatEngine.ts) by collecting `onDelta` into a buffer and
 * resolving when the turn ends. */
export interface OmpOneShot {
  generate(prompt: string, onFirstText?: () => void): Promise<string>;
  /** Cancel the in-flight turn; the command disposes the engine after settlement. */
  cancel?(): void;
  /** Shut down resources after all guard attempts have completed. */
  dispose?(): Promise<void> | void;
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
  /** Build the omp one-shot adapter with the selected Lite model. */
  buildOmpEngine(choice: EngineChoice, modelId: string): Promise<OmpOneShot>;
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
 * Frozen flow (PLAN §2):
 *   1. settings = loadSettings(); if null or lite.modelId empty → settings
 *      toast; if action picked → openSettings(); return.
 *   2. diff = collectDiff(); null → info toast; return.
 *   3. Resolve the engine via `resolveEngine({ engine: settings.engine, … })`.
 *      The user's choice is the single source of truth:
 *        - resolves to "omp"     → buildOmpEngine + oneShot.generate
 *        - resolves to "builtin" → loadConfig + builtinComplete
 *        - selected engine unavailable → showError with the engine-specific
 *          install/update hint from resolveEngine (no silent fallback).
 *      Defend the typed contract: both builtinComplete and oneShot.generate
 *      MUST return a string. If a port ever violates it, surface a structured
 *      Error rather than letting the object reach the sanitizer / input box.
 *   4. Guard + retry + inject (SPEC §8.4): run the engine string through
 *      `generateWithGuard` (sanitize → `checkCommitMessage`). A guard pass
 *      injects; an empty sanitized message (either attempt) emits
 *      metadata-only diagnostics and is NEVER retried; a non-empty guard
 *      failure retries exactly once through `buildRetryCommitPrompt` on the
 *      SAME port/model. A second failure shows the frozen §8.5 toast without
 *      exposing provider text and leaves the input box untouched. Any engine
 *      throw (either attempt) propagates to the branch's existing catch — no
 *      retry on throw.
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

  // 3. Engine selection. The global `settings.engine` is the single source
  // of truth — chat panel and the Generate Commit Message sparkle share it.
  // Per-model engine override was removed; the Lite section in the AI
  // Settings form no longer exposes an Engine dropdown.
  //   "omp"         → resolveEngine keeps it if the binary is installed.
  //   "builtin"     → always honored; config may be missing (toast opens Settings).
  //   "claude-code" / "codex" → no commit-gen adapter today; resolveEngine
  //     returns builtin + an install hint so the user can see exactly why
  //     their selection was rejected instead of being silently swapped.
  const selectedEngine: AiEngine = settings.engine;
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
  let cfg: AiConfig | null = null;
  deps.report?.(PROGRESS_CONTACTING_MODEL);
  // Cancel channel (SPEC FR-003): forward the host's signal onto every
  // ProviderRequest so a cancel reaches the in-flight fetch. When the host
  // supplies none, a fresh non-aborting signal keeps the field populated.
  const requestSignal: AbortSignal = deps.signal ?? new AbortController().signal;
  // Engine routing — closed three-way classification so the validator
  // (`aiSettingsErrors`) gates unknown values upstream. If a future cycle
  // adds a dedicated adapter for one of those engines, add the branch here
  // AND update the JSDoc above to match.
  if (selectedEngine === "omp") {
    const detectionStartedAt = deps.trace ? performance.now() : 0;
    const detection = await deps.detectOmp();
    if (deps.trace) {
      deps.trace.emit("omp.detect.complete", {
        durationMs: traceElapsed(detectionStartedAt),
        available: detection.ok,
        ...(detection.version ? { version: detection.version } : {}),
      });
    }
    const choice = deps.resolveEngine({
      engine: selectedEngine,
      detection,
      config: null,
    });
    if (choice.engine !== "omp") {
      const hint = choice.hint ?? "install omp";
      deps.showError(`${ERROR_OMP_UNAVAILABLE_PREFIX}${hint}`);
      return;
    }
    let oneShot: OmpOneShot | undefined;
    try {
      const turn = await deps.buildOmpEngine(choice, lite.modelId);
      oneShot = turn;
      if (deps.isCancelled?.()) return;
      let attempt = 0;
      outcome = await generateWithGuard(async (messages) => {
        if (deps.isCancelled?.()) throw new Error("commit-gen: cancelled");
        attempt += 1;
        if (attempt > 1) {
          deps.report?.(PROGRESS_RETRYING);
        }
        const serializedPrompt = serializeCommitPrompt(messages);
        const requestStartedAt = deps.trace ? performance.now() : 0;
        if (deps.trace) {
          deps.trace.emit("engine.request.start", {
            engine: "omp",
            attempt,
            promptChars: serializedPrompt.length,
            firstTextObservable: true,
          });
        }
        const onFirstText = deps.trace
          ? () =>
              deps.trace?.emit("engine.first_text", {
                engine: "omp",
                attempt,
                elapsedMs: traceElapsed(requestStartedAt),
              })
          : undefined;
        let raw: string;
        try {
          raw = await turn.generate(serializedPrompt, onFirstText);
        } catch (error) {
          if (deps.trace) {
            deps.trace.emit("engine.request.error", {
              engine: "omp",
              attempt,
              durationMs: traceElapsed(requestStartedAt),
              errorName: error instanceof Error ? error.name : typeof error,
            });
          }
          throw error;
        }
        if (deps.trace) {
          deps.trace.emit("engine.request.complete", {
            engine: "omp",
            attempt,
            durationMs: traceElapsed(requestStartedAt),
            outputChars: typeof raw === "string" ? raw.length : 0,
            firstTextObservable: true,
          });
        }
        if (typeof raw !== "string") {
          throw new Error(ERROR_NON_STRING_TEXT_OMP);
        }
        return raw;
      }, prompt);
    } catch (e) {
      if (deps.isCancelled?.()) {
        return;
      }
      deps.showError(`VSKit: omp error — ${(e as Error).message ?? String(e)}`);
      return;
    } finally {
      if (oneShot?.dispose) {
        const cleanupStartedAt = deps.trace ? performance.now() : 0;
        let cleanupSucceeded = true;
        try {
          await oneShot.dispose();
        } catch {
          cleanupSucceeded = false;
        }
        deps.trace?.emit("omp.cleanup.complete", {
          durationMs: traceElapsed(cleanupStartedAt),
          success: cleanupSucceeded,
        });
      }
    }
  } else if (selectedEngine === "builtin") {
    // resolveEngine is bypassed for "builtin" because the engine is always
    // honored when selected — the only question is whether the global
    // backend config is populated.
    const configStartedAt = deps.trace ? performance.now() : 0;
    cfg = await deps.loadConfig();
    if (deps.trace) {
      deps.trace.emit("config.complete", {
        durationMs: traceElapsed(configStartedAt),
        configured: cfg !== null,
      });
    }
    if (cfg === null) {
      const action = await deps.showSettingsToast(
        TOAST_NO_BACKEND_CONFIG,
        ACTION_OPEN_SETTINGS,
      );
      if (action === ACTION_OPEN_SETTINGS) {
        deps.openSettings();
      }
      return;
    }
    try {
      let attempt = 0;
      outcome = await generateWithGuard(async (messages) => {
        attempt += 1;
        if (attempt > 1) {
          deps.report?.(PROGRESS_RETRYING);
        }
        const result = await callBuiltinWithTrace(deps, cfg as AiConfig, {
          modelId: lite.modelId,
          messages: [...messages],
          maxOutputTokens: 300,
          temperature: 0.2,
          signal: requestSignal,
        }, attempt, selectedEngine);
        if (typeof result.text !== "string") {
          throw new Error(ERROR_NON_STRING_TEXT_BUILTIN);
        }
        return result.text;
      }, prompt);
    } catch (e) {
      if (deps.isCancelled?.()) {
        return;
      }
      const err = e as Error & { bodySnippet?: string };
      const detail = err.bodySnippet ? `: ${err.bodySnippet}` : "";
      deps.showError(`VSKit: provider error — ${err.message ?? String(e)}${detail}`);
      return;
    }
  } else {
    // "claude-code" | "codex" — commit-gen only ships omp + builtin today.
    // resolveEngine hands us back "builtin" with a selected-engine install
    // hint when the user's choice isn't usable, so we still run the request
    // through the OpenAI-compatible backend AND tell them why their engine
    // selection wasn't honored.
    const cfgForChoice = await deps.loadConfig();
    if (cfgForChoice === null) {
      const action = await deps.showSettingsToast(
        TOAST_NO_BACKEND_CONFIG,
        ACTION_OPEN_SETTINGS,
      );
      if (action === ACTION_OPEN_SETTINGS) {
        deps.openSettings();
      }
      return;
    }
    cfg = cfgForChoice;
    const choice = deps.resolveEngine({
      engine: selectedEngine,
      detections: {},
      config: cfg,
    });
    const hint = choice.hint;
    const hintSuffix = hint ? ` (${hint})` : "";
    // The hint toast is informational: it explains why the user's engine
    // selection wasn't honored. Fire it exactly ONCE — after the first
    // successful engine string, before inject — and never again on the guard
    // retry (the retry reuses the same fallback provider, so a second toast
    // would be noise and would break the observed count === 1 contract).
    let hintShown = false;
    try {
      let attempt = 0;
      outcome = await generateWithGuard(async (messages) => {
        attempt += 1;
        if (attempt > 1) {
          deps.report?.(PROGRESS_RETRYING);
        }
        const result = await callBuiltinWithTrace(deps, cfg as AiConfig, {
          modelId: lite.modelId,
          messages: [...messages],
          maxOutputTokens: 300,
          temperature: 0.2,
          signal: requestSignal,
        }, attempt, selectedEngine);
        if (typeof result.text !== "string") {
          throw new Error(ERROR_NON_STRING_TEXT_BUILTIN);
        }
        if (hint && !hintShown) {
          hintShown = true;
          deps.showError(
            `${ERROR_ENGINE_UNAVAILABLE_PREFIX}${selectedEngine}${ERROR_ENGINE_UNAVAILABLE_SUFFIX}${hint}`,
          );
          // We still inject the sanitized message — the user explicitly asked
          // for a generated git message and we can produce one. The toast is
          // informational so they know their engine selection didn't take.
        }
        return result.text;
      }, prompt);
    } catch (e) {
      if (deps.isCancelled?.()) {
        return;
      }
      const err = e as Error & { bodySnippet?: string };
      const detail = err.bodySnippet ? `: ${err.bodySnippet}` : "";
      deps.showError(
        `VSKit: ${selectedEngine} commit-gen fell back to provider error — ${err.message ?? String(e)}${detail}${hintSuffix}`,
      );
      return;
    }
  }

  // 4. Guard verdict. `outcome` is always set: every branch either returns
  // early on error or assigns it above.
  deps.report?.(PROGRESS_VALIDATING);
  // Post-outcome cancel checkpoint (SPEC FR-002): a cancel that landed while
  // the engine ran (including mid-retry) closes silently — no injection, no
  // toast — even when the outcome itself is usable.
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
    // Non-empty, guard-rejected twice. Surface only rejection metadata; never
    // persist or display provider response text. Do NOT touch the input box.
    deps.showError(
      `${ERROR_COMMIT_GUARD_FAILED_PREFIX} (reasons: ${outcome.reasons.join(", ")}). ` +
        ERROR_COMMIT_GUARD_RETRY_NOTE,
    );
    return;
  }

  // Empty (either attempt): preserve the generic diagnostic while keeping
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
