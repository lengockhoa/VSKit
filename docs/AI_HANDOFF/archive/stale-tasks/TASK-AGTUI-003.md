# TASK-AGTUI-003 — Header + brand module: big BLUE "U" glyph + engine-aware title

- Status: `ready`
- Owner: `-`
- Reviewer: `-`
- Parent plan: `docs/AI_HANDOFF/PLAN.md` §2, §3

## Goal

New pure-DOM webview module that builds the Claude Code–style header bar: large blue "U" brand glyph (plain text character, P0 #2), engine-aware title, and session-state chip. No wiring — integration is TASK-AGTUI-007.

## Target Files

- `webview/aiChatPanelHeader.ts` (new) — exports `renderHeader` factory.
- `webview/__tests__/aiChatPanelHeader.test.ts` (new) — jsdom unit test (pattern: `webview/__tests__/*.test.ts`, no esbuild bundling needed for a standalone module).

## Test Cases (REQUIRED — TDD)

| # | Type | Test name | Expected | Pre-state / Fixture |
|---|------|----------|----------|---------------------|
| 1 | happy | renders header and title | `renderHeader()` returns element `.chat-header` containing `#chatBrandMark` with textContent exactly `"C"`, class `chat-mark`, `aria-hidden="true"`; `setEngine("claude-code")` → banner text `Engine: Claude Code — streaming`; banner has `chat-engine chat-engine-claude-code` classes and a neutral static title | empty jsdom document |
| 2 | edge (malformed input) | unknown engine falls back | `setEngine("skynet")` → banner text `Engine: builtin — streaming` + banner class `builtin` (legacy `safeEngineLabel` whitelist fallback, never raw wire string in className/textContent); static title remains neutral | unknown wire literal |
| 3 | edge (boundary) | optional version + absent version | `setEngine("omp","18.0.1")` → banner text contains `oh-my-pi (omp)` and `v18.0.1` (legacy label: `Engine: oh-my-pi (omp) v18.0.1 — streaming`); `setEngine("omp")` (no version) → no version fragment rendered (no stray "undefined") | two calls |
| 4 | edge (state repeat) | session chip replaces, not appends | calling `setSessionState("connecting")` then `setSessionState("running")` leaves exactly ONE `#sessionChip` node; its `className` carries `chat-session chat-session-running` plus `chat-sessionchip`; textContent-only label is `Running…` with zero child nodes; legacy labels remain Connecting…/Running…/Done/Error and `setSessionState(null)` removes the chip | repeated calls |
| 5 | edge (XSS) | hostile label safe | header never uses innerHTML with wire-derived strings; `setEngine` with a string containing `<img onerror>` renders as inert text or falls back to the `builtin` label (whitelist wins, legacy `safeEngineLabel` semantics) | hostile input |

## Test Files

- `webview/__tests__/aiChatPanelHeader.test.ts` (new)

## Verification Commands

```bash
npx vitest run webview/__tests__/aiChatPanelHeader.test.ts
npm run typecheck
```

## Acceptance Criteria

- [ ] All §Test Cases pass; module has zero imports from host-only code (webview-safe: no `vscode` import).
- [ ] Header mark is a plain glyph styled via `.chat-mark` (TASK-AGTUI-001 tokens) — no image/SVG asset.
- [ ] Banner compatibility contract: engine title node carries `id="engineBanner"` + whitelisted `chat-engine chat-engine-<name>` classes, and textContent uses the closed map: `omp→"oh-my-pi (omp)"`, `claude-code→"Claude Code"`, `codex→"Codex"`, `builtin|unknown|null→"builtin"`; format `Engine: <label>[ v<version>] — <state>`. Keep static title neutral and never put product branding in `#engineBanner`; legacy selector tests remain unmodified.

## Dependencies

- none

## Interfaces

- Consumes: CSS `.chat-header`, `.chat-mark`, `.chat-title`, `.chat-sessionchip` from TASK-AGTUI-001 (classes only; this task compiles without it).
- Produces (exact signature):
```ts
export type HeaderEngine = "omp" | "claude-code" | "codex" | "builtin";
export interface ChatHeader {
  el: HTMLElement;              // .chat-header, contains #engineBanner + #chatBrandMark + #sessionChip
  setEngine(name: HeaderEngine | null, version?: string): void; // null → "builtin"
  setSessionState(state: "connecting" | "running" | "done" | "error" | null): void;
  //   Legacy contract (pinned by aiChatPanelSessionStateWebview.test.ts:85-118 — TASK-AGTUI-007
  //   must pass UNMODIFIED; legacy source webview/aiChatPanelMain.ts:1503-1525): creates/reuses
  //   ONE node id="sessionChip"; className = `chat-session chat-session-<state>`
  //   + the ADDITIONAL clone class `chat-sessionchip`; textContent-only labels —
  //   connecting→"Connecting…", running→"Running…", done→"Done", error→"Error" (no child
  //   nodes, never innerHTML); null → removes the chip.
}
export function renderHeader(root: HTMLElement): ChatHeader; // appends el to root
```
  Engine→banner label map (closed — MUST reuse legacy strings verbatim from `ENGINE_LABELS`/`safeEngineLabel`, `webview/aiChatPanelMain.ts:1437-1465`): `omp→"oh-my-pi (omp)"`, `claude-code→"Claude Code"`, `codex→"Codex"`, `builtin|unknown|null→"builtin"`; banner text format `Engine: <label>[ v<version>] — <state>`. Keep all static title copy neutral, with branding NEVER inside `#engineBanner` textContent. Consumed by TASK-AGTUI-007.

## Executor Report

(appended below by executor)

---

## Reviewer Verdict

(appended below by reviewer)

## Executor Report

EXECUTOR_TOOL: Claude Code (Agent tool)
EXECUTOR_MODEL: unic-code
EXECUTOR_SUBAGENT: feature-implementer
RED_OUTPUT: |
  FAIL  webview/__tests__/aiChatPanelHeader.test.ts [ webview/__tests__/aiChatPanelHeader.test.ts ]
  Error: Failed to resolve import "../aiChatPanelHeader" from "webview/__tests__/aiChatPanelHeader.test.ts". Does the file exist?
   ❯ TransformPluginContext._formatError ../../node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49258:41
   ❯ TransformPluginContext.transform ../../node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49266:7
  Test Files  1 failed (1)
       Tests  no tests
Verification Output: |
  RUN  v1.6.1 /workspace/.worktrees/task-agtui-003
   ✓ webview/__tests__/aiChatPanelHeader.test.ts  (10 tests) 14ms
   Test Files  1 passed (1)
        Tests  10 passed (10)
  > extension@1.53.24 typecheck
  > tsc --noEmit
  (clean exit, no output)
Status: PASS
Note: header module is pure-DOM, no vscode imports; safeEngineClassName whitelists
  unknown strings (e.g. "<img onerror=...>" → builtin) so the banner DOM + className
  never carry raw wire data. Session-chip test originally asserted
  childNodes.length===0 (text node from textContent counts as a child); corrected
  to querySelectorAll("*").length===0 to match the legacy
  aiChatPanelSessionStateWebview.test.ts:116 contract.

## Reviewer Report
REVIEWER_MODEL: unic-smart
Verdict: APPROVED-WITH-MINOR
Findings:
  - minor (spec path drift): Task spec + Interfaces cite `webview/__tests__/aiChatPanelWebview.test.ts` and `aiChatPanelSessionStateWebview.test.ts`; the real fixture files live at `src/ui/__tests__/aiChatPanelWebview.test.ts` and `src/ui/__tests__/aiChatPanelSessionStateWebview.test.ts`. Pinned line numbers (424-461, 880-935 / 85-118) match the real files exactly — only the directory is wrong. Fix the references before TASK-AGTUI-007 relies on them.
  - minor (spec bug, per review scope #2): pinned fixture #5b (`src/ui/__tests__/aiChatPanelWebview.test.ts:433-443`) requires `Engine: builtin — <hint> — streaming`, but the spec's `setEngine(name, version?)` signature has no `hint` parameter, so this module alone cannot render the hint variant (legacy `applyEngine` at base 515d87e supported `msg.hint`). Fixture currently passes (43/43 at HEAD), so wave-2 integration must be serving hint via another path — flag to TASK-AGTUI-007's reviewer to confirm hint is still reachable.
  - minor (test gap): new unit test never calls `setEngine("codex")`; the fourth closed-map label ("Codex") is only pinned indirectly by legacy fixture #T12-engine-3. Add one assertion to `webview/__tests__/aiChatPanelHeader.test.ts`.
  - minor (type nit): `aiChatPanelHeader.ts:137` declares `name: HeaderEngine | null | unknown` — union collapses to `unknown`; write `unknown` alone.
  - clean: engine labels match the closed map; banner format is exact; unknown/hostile inputs fall back to builtin without raw wire strings in className/textContent; the session chip reuses one node with `chat-session` and `chat-sessionchip` classes and text-only labels; the plain mark is aria-hidden; no innerHTML, no vscode import, and no unrelated selectors touched (frozen-selector guard clean).
  - clean: TDD RED genuine — RED_OUTPUT shows real module-resolution failure (file absent), not a bare claim.
Verification rerun (this reviewer, HEAD 6324c43):
  - `npx vitest run webview/__tests__/aiChatPanelHeader.test.ts` → 10 passed (10)
  - `npm run typecheck` → clean
  - Compatibility: `npx vitest run src/ui/__tests__/aiChatPanelSessionStateWebview.test.ts src/ui/__tests__/aiChatPanelWebview.test.ts` → 52 passed (52), pinned fixtures unmodified
