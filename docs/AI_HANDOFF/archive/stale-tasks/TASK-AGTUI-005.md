# TASK-AGTUI-005 — Thread rendering module: bubbles, thinking blocks, tool cards, mentions

- Status: `ready`
- Owner: `-`
- Reviewer: `-`
- Parent plan: `docs/AI_HANDOFF/PLAN.md` §2, §4

## Goal

Extract the chat-thread DOM builders from `webview/aiChatPanelMain.ts` (lines ~982-1560: `appendUser`, `appendThinking`, `appendStep`, `appendToolResult`, `appendChangePlan`, error/notice bubbles, usage chip, `renderMarkdown`) into a new pure module with the SAME class names + security invariants (textContent-only for wire strings). Main will consume it in TASK-AGTUI-007.

## Target Files

- `webview/aiChatPanelThread.ts` (new) — exports the builder functions (moved logic, clone class names added alongside existing ones).
- `webview/__tests__/aiChatPanelThread.test.ts` (new) — jsdom unit tests.

## Test Cases (REQUIRED — TDD)

| # | Type | Test name | Expected | Pre-state / Fixture |
|---|------|----------|----------|---------------------|
| 1 | happy | bubble set renders | `appendUserBubble(t,"hi")` → `.chat-msg-user` with exact text; `appendAssistantBubble(t,"**md**",true)` → `.chat-msg-assistant` containing rendered `<strong>md</strong>`; thinking/step/tool-card/error/usage helpers each produce their §TASK-AGTUI-001 class | fresh thread element |
| 2 | edge (malformed/XSS) | hostile wire strings inert | user text `<img src=x onerror=alert(1)>`, tool name/summary with HTML → rendered via textContent/createTextNode; `document.querySelectorAll("img[src=x],onerror")` finds nothing; markdown path escapes before render (same escaping as current `escapeHtml`) | hostile fixtures |
| 3 | edge (duplicate) | plan card fires once | `appendChangePlanCard` approve button: click → `onApprove` called exactly once, buttons disabled after first click; reject likewise; unknown `status` on `appendToolCard` → card renders with base class, no crash | double-click dispatch |
| 4 | edge (empty) | empty strings render cleanly | `appendAssistantBubble(t,"",true)` → empty bubble node, no `undefined`/`NaN` text; `appendToolCard(t,"sql","denied","")` → `.chat-tool-denied` card with empty body, no throw | empty fixtures |
| 5 | edge (boundary) | usage chip unknown tokens | usage `{inputTokens:0,outputTokens:0,unknown:true,sessionTokens:{inputTokens:9,outputTokens:1},policyNotice:"n"}` → chip shows session totals, renders "unknown" marker NOT "0"; `unknown:false` → shows per-turn numbers (mirrors current TASK-ARP06-005 contract) | two fixtures |

## Test Files

- `webview/__tests__/aiChatPanelThread.test.ts` (new)

## Verification Commands

```bash
npx vitest run webview/__tests__/aiChatPanelThread.test.ts
npx vitest run src/ui/__tests__/aiChatPanelWebview.test.ts   # parity reference: still green (main unchanged at this point)
npm run typecheck
```

## Acceptance Criteria

- [ ] All §Test Cases pass; module webview-safe (no `vscode` import); logic is MOVED not rewritten — same ids/classes the existing webview tests pin (queued chat state, spinner row contract, plan card structure).
- [ ] No edits to `webview/aiChatPanelMain.ts` (extraction only; deletion of the originals happens in TASK-AGTUI-007).

## Dependencies

- none

## Interfaces

- Consumes: CSS classes from TASK-AGTUI-001 (`.chat-msg-*`, `.chat-thought`, `.chat-tool*`, `.chat-plan`, `.chat-error`, `.chat-usage`).
- Produces (exact signatures — consumed by TASK-AGTUI-007):
```ts
export function renderMarkdown(text: string): string;             // moved from main
export function appendUserBubble(thread: HTMLElement, text: string): HTMLElement;
export function appendAssistantBubble(thread: HTMLElement, text: string, markdown: boolean): HTMLElement;
export function appendThinkingRow(thread: HTMLElement): HTMLElement;        // returns row for removal
export function removeThinkingRow(thread: HTMLElement, row: HTMLElement): void;
export function appendStepRow(thread: HTMLElement, label: string): HTMLElement;
export function appendToolCard(thread: HTMLElement, tool: string, status: "ok"|"failed"|"denied", summary: string): HTMLElement;
export function appendChangePlanCard(thread: HTMLElement, plan: {intent:string; statements:Array<{sql:string;tier:string;dangerNote:string}>; drift:string[]; drifted:boolean}, handlers: {onApprove(): void; onReject(): void}): HTMLElement;
export function appendErrorBubble(thread: HTMLElement, message: string): HTMLElement;
export function appendNoticeBubble(thread: HTMLElement, message: string): HTMLElement;
export function renderUsageChip(container: HTMLElement, usage: {inputTokens:number; outputTokens:number; unknown:boolean; sessionTokens:{inputTokens:number; outputTokens:number}; policyNotice:string}): void;
```

### 2026-09-08 · planner · unic-smart
`sqlHighlight` import used by markdown/code paths may come along — keep the import relative (`./sqlHighlight`) so esbuild bundling in the harness still resolves.

## Executor Report

```text
EXECUTOR_TOOL: Claude Code (Agent tool)
EXECUTOR_MODEL: claude-sonnet-4-5
EXECUTOR_SUBAGENT: feature-implementer

RED_OUTPUT:
  Test Files  1 failed (1)
  Tests       no tests
  Error: Failed to resolve import "../aiChatPanelThread" from "webview/__tests__/aiChatPanelThread.test.ts". Does the file exist?

Verification Output:
  Command: npx vitest run webview/__tests__/aiChatPanelThread.test.ts
  Result:  1 file passed (25 tests passed), 0 failed
  
  Command: npx vitest run src/ui/__tests__/aiChatPanelWebview.test.ts
  Result:  1 file passed (43 tests passed), 0 failed
  
  Command: npm run typecheck
  Result:  exit 0 (no diagnostics)

Status: PASS
Note: Discovered mid-run that the worktree had no local node_modules — copied parent repo's node_modules so esbuild binaries are discoverable. The parity test file (src/ui/__tests__/aiChatPanelWebview.test.ts) does not have a worktree-fallback for esbuild (cf. aiChatPanelWebviewTask005.test.ts which has one), so without node_modules it could not run; the typecheck + the new thread test passed immediately. After provisioning node_modules, all three verification commands are green in one pass: 25 + 43 tests + tsc --noEmit.
```

---

## Reviewer Report

REVIEWER_MODEL: unic-smart (config handoff.reviewer.model match; executor self-reported claude-sonnet-4-5 — isolation OK)
Verdict: CHANGES-REQUESTED

Verification re-run (reviewer, fresh): `npx vitest run webview/__tests__/aiChatPanelThread.test.ts` 25/25 PASS; `npx vitest run src/ui/__tests__/aiChatPanelWebview.test.ts` 43/43 PASS; `npm run typecheck` exit 0. Test-plan coverage: all 5 spec cases implemented with real assertions; RED_OUTPUT is genuine (vitest module-resolution failure while the module was absent).

Findings:
- IMPORTANT webview/aiChatPanelThread.ts:403 — `appendErrorBubble` emits `.chat-msg-error`, but the shared contract and stylesheet provide `.chat-error`, so the error bubble would be unstyled after the builder swap. Align the emitted selector with the existing style or revise the contract.
- IMPORTANT webview/aiChatPanelThread.ts:82,94 — 4 raw NUL (0x00) bytes where the original used `\u0000` escape sequences in source text (base main @515d87e had 0 NUL bytes). Runtime-identical, but the file is committed as BINARY in git (87ec6e2 shows `Bin 0 -> 17680 bytes`): no text diffs in PRs/history, and grep/ripgrep silently skip the file (reviewer's own greps missed it on first pass). Fix: replace the raw NUL bytes with `\u0000` escape text in the template literal (line 82) and the regex (line 94); behavior unchanged, git diff becomes text again.
- MINOR webview/aiChatPanelThread.ts:433-468 — `renderUsageChip` appends a new chip on every call; the original reused one `#usageChip` node (replace-not-append). Callers invoking it per turn on a persistent container can stack chips. Fix: remove an existing `.chat-usage` child before appending, or state the clear-before-call contract in the JSDoc.
- MINOR webview/aiChatPanelThread.ts:270 — `chat-tool-ok` modifier is not in the contracted selector set (only `-failed`/`-denied`) and is unstyled. Harmless (base `.chat-tool` styled); add the token to the clone layer or drop the suffix.
- MINOR (scope note) — collapsible thinking blocks (`.chat-thinking` details/summary) and `.chat-thought` are not produced by this module. The task Interfaces contract only requires the spinner row (`appendThinkingRow`/`removeThinkingRow`), so this matches spec; confirm ownership so `.chat-thought` is not orphaned.

Passes: bubble roles `.chat-msg-user`/`.chat-msg-assistant` match the shared contract and stylesheet; no header/composer/frozen-selector leakage (all queries scoped to passed roots; no stylesheet edits in this task); wave-1 isolation clean (sole import `./sqlHighlight`; no `vscode`/`src/` imports; main webview entry untouched by this task); moved logic otherwise faithful to base implementation.
