# UKIT Internal Orchestration

Loaded on demand — root contracts carry the compact contract; this file carries the detail.

Everything below is internal orchestration: end users only ever need `ukit install` plus
natural language. None of it adds commands or user-facing surface.

## Long-Run Continuity — detail

The root contract carries the LAND/DEFER/DELEGATE summary. This section mirrors what UKit
hooks inject at runtime on Claude Code and omp; on harnesses without hooks (Codex)
the root contract is the only carrier — keep both in sync with
`.claude/hooks/context-window-guard.sh`.

- Near token-cap: **LAND one thing** — finish the smallest in-flight item end-to-end
  (edit + verify, ≤3 tool calls) and report it done. **DEFER the rest** — one line per
  remaining step into `docs/STATUS.md`, or split into bounded `docs/AI_HANDOFF/` tasks.
  **DELEGATE** broad work (searches, big reads, multi-file edits) to subagents whose tool
  output lives in their own windows. Only then compact.
- After any compact or handoff: do not reread pre-compact context — continue from the
  persisted disk state, delegate broad work, keep replies short. If the first turn after a
  compact still sits at ≥60% of the cap, stop rereading immediately and recover by
  delegating or starting a fresh session from the disk state; do not burn the window again.
- A run ends only on completion evidence, a genuine blocker, or a user-only action — and
  every such stop names its reason in the final reply.

## Index-First Loop — helper commands

- `node .claude/ukit/index/refresh-index.mjs` — refresh when `.cache/index/` is stale or
  missing; fallback: `node .claude/ukit/index/build-index.mjs`.
- `node .claude/ukit/index/query-index.mjs "<error|symbol|path>"` — likely files.
- `node .claude/ukit/index/triage.mjs "<error signature>"` — bug signatures.
- `query-index` and `resolve-context` print an `outline:` block (`line: signature`) for the
  top suspects — jump straight to the relevant region with `Read(file, offset=<line>)`
  instead of reading the whole file.

## Automatic Skill Activation — route memory

- If docs work is detected, read `.claude/skills/docs-quality/SKILL.md` when present.
- Reuse `.claude/ukit/skill-router-state.json` when it already carries compact route memory.
- If shared route state already includes `previous-context` or `recent-output`, reuse those
  first.
- Prefer routed context and routed verification over ad-hoc broad reading.

## Internal Helper Policy — detail

- Prefer `node .claude/ukit/index/route-task.mjs "<prompt>" [--tool-command <cmd>]
  [--target <file>]` when routing is complex or ambiguous.
- Prefer `node .claude/ukit/index/resolve-context.mjs ...` for indexed related-file context.
- Prefer `node .claude/ukit/index/verify-context.mjs ...` for concrete verification lanes.
- Context-layer docs are declared in `manifests/documentation.yaml` (`context_layers`) and
  surfaced in the route summary line via the `docs=[...]` basename segment
  (`routeSummary.contextDocs`; DOC-201). The routing-side copy is `CONTEXT_LAYER_DOCS` in
  `src/index/taskRouting.js` / `route-task.mjs` — keep it in sync with the manifest.
- Do not ask normal contributors to memorize `ukit doctor`, `ukit diff`, `ukit uninstall`,
  or `ukit index ...` unless they explicitly need maintainer/debug help.
- If the workspace needs a refresh, prefer telling them to rerun `ukit install`.

## Skill Quality (maintainer-only)

- When editing a template skill/agent under `template_project/.claude/`, read
  `.claude/skills/skill-quality/SKILL.md` before shipping the change.

## Shared Runtime — detail

- Shared runtime state lives in `.ukit/storage/`.
- Treat `.ukit/storage/config.json` as the source of runtime toggles for compact, token
  pipeline, router, memory, validation, and Safe Patch behavior.
- Reusable cache/compact/output state lives in
  `.ukit/storage/cache/prompt-cache.json`,
  `.ukit/storage/cache/compact-history.json`,
  `.ukit/storage/cache/compact-pressure.json`,
  `.ukit/storage/cache/output-history.json`, and preserved raw tool outputs under
  `.ukit/storage/cache/tee/`.
- If an older repo still has a visible `ukit/` runtime root, rerun `ukit install`; UKit
  should migrate the shared runtime into hidden `.ukit/` when safe.
- Maintainers can inspect runtime state with `ukit status` and `ukit memory export`, but
  normal teammates should still only need `ukit install`.
- Threshold-based compact pressure is internal orchestration; do not expose it to users.
- For Codex Desktop long sessions, UKit can use soft auto-compact handoffs. Default
  `compact.codexContext.compactTarget=150` means about 150 compact handoff lines
  (120-150 preferred, hard max 170), not 150 tokens.

## Safe Patch — internal helper

- Use `node .claude/ukit/index/safe-patch.mjs` internally when normal Edit/Write may
  normalize bytes or when anchor-based matching is needed.
- Safe Patch is internal orchestration: normal users still only need `ukit install` and
  natural language.

## Context + Verification Budget — detail

- `docs/STATUS.md`: stale status is orientation only.
- `docs/TASKS.md`: safely clean exact duplicates/completed overflow by default without
  deleting unfinished human-authored tasks.
- `docs/WORKLOG.md`: follow the Budget Rules at the top of the file; archive oldest entries
  to `docs/WORKLOG_ARCHIVE.md` when over limits.
- Follow routed verification policy: targeted first, widen only when risk/shared scope
  justifies it, ask before blanket broad runs.

## Living Status Workflow — detail

- `docs/STATUS.md` captures compact current state, active work, debug threads, blockers,
  verification, and next candidates.
- For "what next?" / "continue" prompts without a concrete target, use `next-step` and show
  a freshness cue before relying on the status file.
- For concrete debug/implementation/review prompts, keep the concrete workflow primary even
  if the user asks for an approach or next step.
- After meaningful work, use `update-status`; skip trivial/no-state-change tasks and avoid
  transcript-style noise.
- `docs/TASKS.md` is a local AI task queue: prefer `Ready for AI` when asked to pick queued
  work, and clean duplicates/prune `Done Recently` safely when reading/updating it.

## Small-Task Maintainer — detail

- UKit may route low-risk internal decisions to the `ukit-small-task-maintainer` subagent
  using `subagents.smallTaskModel` (default `unic-lite`).
- Use it for safe/reversible UKit chores: cleaning `docs/TASKS.md`, queued-task
  classification, fast-vs-slow/safe-vs-risky lane decisions, skill-routing/step-budget
  hints, agent context-budget decisions, compact/summary decisions, docs/status
  summarization, auto-triage, queue maintenance, and small workspace cleanup.
- Run it as a sidecar/parallel lane only; do not block, replace, or slow the user task.
- If the small-task lane sees security, risky/shared code, release/publish, data-loss,
  architecture, deep-reasoning risk, weak context, or quality risk, it hands back to the
  main model.
- This is optional internal orchestration config from `.ukit/storage/config.json`; never
  turn it into an end-user workflow.
- Always preserve the CoDev priority: quality > safety > speed > token discipline.


## Selective Subagent Policy — detail

- Good delegation triggers:
  - noisy side lanes (broad logs/search/test output)
  - 3+ independent failures/files/checks
  - explicit batch/plan execution
  - broad implementation/debug lanes that can return a concise summary
- If route memory includes `delegate=<lane>`, treat it as an internal hint after any
  required indexed-context step.

## 3-Tier Model Routing — full detail

`unic-decision` is **not** another LLM tier. The owner built this local,
near-zero-cost Lava/JEV model in UNIC Provider for fast typed semantic
decisions; the OpenAI-compatible API is a convenience transport, not a
generative-LLM or external-hosting claim. When `decisionPlane.stage` enables
it, use bounded candidate choices/rankings/scores through
`.claude/ukit/index/unic-decision.mjs`; keep safety, authorization and
completion gates deterministic. The shipped stage is `off` until explicitly
promoted. See `docs/pstack/UNIC_DECISION_SPEC.md` in the UKit development repo.

UKit routes tasks to one of three model tiers based on task complexity. The main session
model never changes mid-turn: a tier only takes effect when work is handed to an agent
whose own definition binds that model.

| Tier | Generic alias | Claude model | Typical tasks |
|------|--------------|--------------|---------------|
| lite | `unic-lite` | claude-haiku | Reads, git queries, bash summaries, small doc edits |
| code | `unic-code` | claude-sonnet | Normal coding, local fixes, shared edits, builds, debugging, impact mapping |
| smart | `unic-smart` | claude-opus | Release review/audit, and escalated deep reasoning after repeated failure |

### Contract-to-tier mapping

| Contract | Tier |
|----------|------|
| `tiny-fix` | lite |
| `local-fix`, `local-build`, `shared-edit`, `find-cause`, `map-impact` | code |
| `review-release` | smart |

### How a tier is actually bound

| Harness | Agent definitions | How to launch one |
|---------|-------------------|-------------------|
| Claude Code | `.claude/agents/*.md` (`model:` frontmatter) | Agent tool, `subagent_type: "<name>"` |
| omp | `.omp/agents/*.md` (`model: "@smol"` / `"@default"` / `"@slow"` / `"@vision"`, resolved through `modelRoles` in `.omp/config.yml`) | task-agent `<name>` |

When a task's contract maps to a tier other than the current session model, hand it to the
matching agent instead of doing it inline. Doing everything inline is exactly what makes
UKIT behave as if it only had one model — the tier table above has no effect on its own.

### Escalation rule

When the same file or symbol fails `debugLoopThreshold` (default: 2) times in one session,
UKit routes the next attempt one tier higher (capped at `smart`). Config:
`orchestration.escalation` in `.ukit/storage/config.json`.

### Vision lane (capability, not a cost tier)

`unic-vision` is a **capability lane**, not a fourth cost tier — it is orthogonal to
lite/code/smart above and never appears as a row in the tier table. Whether a mapping can
read images is a capability fact, not a provider fact: a mapping that has not **verified**
native vision must never guess at image contents — choose native-first when verified,
otherwise route to the specialist.

- **Gateway detection**: UNIC routing for a Claude Code session is decided ONLY by what
  changes Claude Code's own outbound endpoint — `ANTHROPIC_BASE_URL` (env var, or the
  `env.ANTHROPIC_BASE_URL` key in project/home `.claude/settings.json`) containing
  `unicjsc.com`. Other tools' configs — Codex `config.toml`, Kilo `secrets.json`, or an
  `OPENAI_BASE_URL` env var — describe a different tool's endpoint entirely and never
  decide this session's routing.
- **Advisory routing (no hard block)**: when an image reaches the prompt, the vision router
  reminds the session to have `ukit-vision-analyst` analyse it before relying on its
  contents. Edits are **never blocked** — correctness relies on the model routing images
  to the analyst instead of guessing.
- This is internal orchestration — end users never invoke a vision command directly;
  `ukit install` plus natural language remains the whole surface. No new commands.

## DuraOne — detail

- Khi active: luôn đọc `.claude/skills/duraone/SKILL.md` trước khi code.
- References:
  - `.claude/skills/duraone/references/frontend.md`
  - `.claude/skills/duraone/references/backend.md`
  - `.claude/skills/duraone/references/sql.md`
  - `.claude/skills/duraone/references/workflow.md`
- Khi không active: dùng generic coding standards + project-specific patterns từ index.

## Learning loop — detail

Phase-4 telemetry → advisory tuning loop (FR-206, TASK-232).

- **Config namespace `learning.*`** (optional-present; absent → defaults merge + valid):
  - `learning.feedback.enabled` (default `true`) — gates `collectFeedbackEvents`.
  - `learning.feedback.maxEvents` (default `200`) — cap on labeled feedback events.
  - `learning.proposals.minCount` / `learning.proposals.minSessions` (defaults `3`/`2`) — pattern-proposal thresholds.
  - `learning.episodes.autoWrite` (default `false`) — gates the SessionEnd episode hook.
  - `learning.tuning.enabled` / `learning.tuning.applyMode` (defaults `true`/`'manual'`; `'off'` disables computation).
- **Artifacts** (all under `.ukit/storage/`, written tmp+rename):
  - `learning/feedback-events.json` — labeled wrong-route events (`rescue`, `re-route`, `repeat-stall`, `user-correction`).
  - `learning/skill-accuracy.json` — per-skill trigger/join/accuracy roll-up.
  - `learning/suggestions.json` — result of `computeTuningSuggestions(projectRoot)` (`src/learning/tuning.js`).
  - `cache/retriever-lanes.jsonl` — per-query lane hit/weight telemetry consumed by `collectLaneStats`.
- **Advisory-only contract**: `suggestions` carry `{target, current, suggested, evidence}`; `applied` is always `[]`. `applyMode` is restricted to `manual|off` — **no writer ever mutates `codeIntel.retriever.weights` or `orchestration.escalation.debugLoopThreshold`**. Rules: lane weight ±0.1 step (clamped `[0.1, 2.0]`) when events ≥ 50 with a >0.5 dominant lane and a <0.02 starved lane; `debugLoopThreshold − 1` (min 1) when repeat-stall events ≥ 10. `ukit metrics` prints a `learning` section (pending count + targets; `n/a` when the artifact is absent).

## Permission Modes + Unsafe Eval — detail

C38 unified permission model. `orchestration.permissionMode` (optional-present; absent tolerated for pre-C35 configs) declares one of three reserved modes — only `unattended` is implemented end-to-end today; `interactive`/`safe-auto` are modelled in the compiler so doctor can report on them but are not rendered modes.

- **`interactive`** — prompts are expected; mode fallback for unclassified entries is `prompt`. Doctor reports reachable prompts as INFO, never FAIL.
- **`safe-auto`** — same `prompt` fallback, modelled as "auto-allow safe classes, prompt the rest"; reachable prompts remain INFO.
- **`unattended`** — no human in the loop; mode fallback is `allow` for unclassified entries and any reachable `prompt`/`ask` on a managed surface is a doctor FAIL (`unattended-prompt`), because a prompt dead-ends the run.
- **Unattended ≠ all-destructive-allowed.** The canonical deny set (`CANONICAL_DENY` in `src/core/permissionPolicy.js`) applies in every mode; `hard-deny` entries (root/home/parent/dot recursive deletes, raw-device writes, mkfs, fork-bomb) are denied on every host including report-only codex, and `protected-guard` hooks (release credentials, protected files, stale-spec guard) outrank any host-deny. A deny never becomes a question — the agent picks the next safer alternative that satisfies the intent and records the substitution.
- **Host-internal waits are unchanged** — announce long waits, surface API/tool errors verbatim, name network/API as the suspect on stalls; the permission model does not alter the Stall & Wait Reporting contract.

`orchestration.allowUnsafeEval` (default `false`, optional-present boolean, migration never enables): only an explicit `true` renders `tools.approval.eval: allow` in `.omp/config.yml` via the `omp.evalApproval` render variable; every other state renders `deny` — fail-closed, never `prompt`. Residual risk stays documented: eval can carry subprocess payloads (`os.remove`, `shutil.rmtree`) that text-level `bash.patterns` denies cannot see.

Internals: `src/core/permissionPolicy.js` compiles the semantic policy (precedence hard-deny > protected-guard > host-deny > explicit-allow > mode-fallback; `UKIT_EPOLICY` on unknown mode). `src/core/permissionDoctor.js` backs `ukit doctor --permissions [--json]` — FAIL classes `unattended-prompt`, `deny-loss`, `unsafe-eval-mismatch`, `unrendered-token` exit 1; JSON shape `{ permissions: { declared, effective, hosts, checks, failures } }`. Template render, doctor, and the no-freeze matrix consume the same compiler so surfaces cannot drift.

## Hook budget

- **Cap: 8 chain steps per hook group** (current max is 6). Any new step must also
  carry a `:N` suffix with N > 0 — the runner never falls back to an implicit budget
  for a declared chain.
- **Outer timeout = Σ(:N) + 10s minimum.** `settings.json` `timeout` is host-enforced
  and cannot be derived at runtime, so the margin is enforced by
  `tests/hooks/hookChainBudget.test.js` — forgetting to bump the outer fails loudly.
  Every shipped group currently sits at exactly +10s.
- **Why env knobs can't violate the invariant:** `UKIT_HOOK_*_MS` only affect fallback
  budgets for args that lack `:N`. On all-declared chains the inner budget is Σ:N by
  construction, so inner ≤ outer − 10s holds regardless of env (the omp bridge shares
  the `hook-chain-budget.mjs` resolver).
- **Convention: hot-path hooks ship as `.mjs` module steps, not new `.sh` processes.**
  Each new `.sh` step costs a fresh spawn (~30–100ms on the hot path); `.mjs` steps run
  in-proc in the runner with identical `:N` semantics. Keep the `.sh` thin wrapper
  only when a direct/debug invocation path is needed.
- **Module-step contract:** a `"<path>.mjs[:N]"` arg is imported in-proc and must
  export `runHook(ctx) -> {code, stdout, stderr}`; `ctx` =
  `{payload, payloadText, projectRoot, env, deadlineMs, signal}`. A throw reports
  `error`; a `deadlineMs`/`signal` breach reports `timeout` + `killed`. Export
  `hookFailClosed = true` to join the fail-closed registry (infra failure → exit 2,
  else 1) — the name-based `FAIL_CLOSED_SCRIPTS` list covers
  `sensitive-data-guard.mjs` + `block-dangerous.mjs`. `isDirectRun()` gates a CLI
  mode so the same file stays directly invocable; `UKIT_HOOK_DEADLINE_MS` is
  scrubbed from `process.env`/`ctx.env` around import. Shipped modules:
  `sensitive-data-guard.mjs`, `block-dangerous.mjs`, `record-execution.mjs`
  (`hookFailClosed = false`; uses `setLedgerMessageEmitter` on
  `execution-ledger.mjs` for the `noteSweepFailure` systemMessage).
- **Failure taxonomy + `--emit-verdict` mapping.** Every `results[]` entry carries a
  `failureKind` from one closed set — `ok` (child exited 0), `exit-code` (child exited
  non-zero on its own), `output-overflow` (capture exceeded the 2 MiB maxBuffer and the
  tree was culled), `timeout` (the runner killed the child at its deadline), `signal`
  (the child died from a signal the runner did not send), `error` (the child never
  spawned), `spawn-unavailable` (win32 only: no usable bash could be found or started for
  a `.sh` script — see the launcher bullet below), `budget-exhausted` (the script never
  ran — the chain total budget was spent first). The `--emit-verdict` contract maps them onto one exit code: `ok`/`exit-code 0`
  and any non-fail-closed failure → exit 0 (fail OPEN); a real `exit-code 2` block, or
  ANY failure on a fail-closed gate (`output-overflow`, `timeout`, `signal`, `error`,
  `budget-exhausted`) → exit 2 (fail CLOSED). An overflowed capture is dropped whole
  before it can be replayed, so a truncated stream can never masquerade as a verdict.
  `tests/hooks/hookChainFailureSurface.test.js` pins these surfaces.
- **Windows bash launcher.** On win32 a `.sh` hook is not executed directly; the runner
  launches it through Git Bash. The bash binary is the first hit of: an absolute
  `UKIT_BASH_BIN` → `CLAUDE_CODE_GIT_BASH_PATH` → the Git for Windows default install
  paths → absolute `PATH` entries (the System32 and WindowsApps `bash.exe`, i.e. WSL, are
  skipped; a relative or cwd `bash.exe` is never used). The script path is passed with
  forward slashes. When no candidate exists or the spawn fails, the entry is
  `spawn-unavailable`: it warns instead of denying every Edit/Write/Bash. That kind is
  win32-launcher-only — POSIX spawn errors stay `error` and fail closed, and timeouts,
  real `exit-code 2` blocks, missing gate files and `block-dangerous.sh` stay fail closed
  on every platform. `UKIT_HOOK_SHELL_PLATFORM` is a diagnostic override of the platform
  the launcher assumes.
- **stderr is a diagnostic channel, not verdict payload.** Under `--emit-verdict` the
  runner drops the stderr of every non-verdict script: stdout is the verdict and Claude
  Code parses it as ONE JSON document, so interleaving arbitrary hook diagnostics there
  would break the contract (and leak whatever a hook happened to log). This is a
  deliberate decision, not an open gap — stderr is replayed only where it carries the
  verdict itself: the decision owner's stderr, the last executed script's stderr (block,
  fail-closed-infra, and pass paths), and the runner's own synthesized diagnostics (the
  unrun-gate line, `... could not produce a verdict (<failureKind>)`, the empty-chain
  line). To surface diagnostics from an earlier step, have the step that owns the
  verdict include them.
- The same test also guards the settings↔bridge mirror: `HOOK_EVENT_MAP` in
  `template_project/.omp/hooks/pre/ukit-bridge.js` must equal the settings chain args 1:1
  per event/matcher.

## Compressed contract detail (cycle 45 diet)

Detail dropped from `template_project/instructions/core.md` during the ~25% system-prompt diet; semantics unchanged.

- **Prompt Caching one-liners** — CTX-01 deterministic segment bytes · CTX-02 keep roles and order · CTX-03 keep tool IDs and continuation state · CTX-04 no clock/random IDs in static blocks · CTX-05 compaction starts a new epoch · CTX-06 never change data to match a cache · CTX-07 no unconfirmed cache fields · CTX-08 tool-result reuse needs valid freshness · CTX-09 missing usage is unknown, not zero · CTX-10 never cut a required check to reduce calls. Full ruleset: `docs/PROMPT_CACHING.md`.
- **Common skill triggers** — review/audit/diff/PR → `code-review` · bug/error/crash/triage → `debugging-toolkit` · test/spec/coverage → `testing-quality` · docs/README/changelog/`docs/` edits → `docs-quality` · open-ended/status/continue/queued task → `next-step` · wrap up/`docs/STATUS.md` → `update-status` · auth/security/token/permission/risky → `discover-security` · stale workspace/reinstall/cleanup → `repo-maintenance` (all under `.claude/skills/<name>/SKILL.md`).
- **3-Tier typical tasks** — lite: reads, git queries, bash summaries, small doc edits · code: normal coding, shared edits, builds, debugging, impact mapping · smart: release review/audit, escalated deep reasoning after repeated failure.
- **UNATTENDED-02 tightened** — `maxAttemptsPerFailure` 5 → 2, `maxRecoveryStrategies` 3 → 2 (retry the same edit, then fix the cause differently; never loop one strategy).
