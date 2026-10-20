# TASK-SH-001 — Manifest: `VSKit.runShellSelection` command + Cmd/Ctrl+Enter shellscript keybindings

- Status: `ready`
- Owner: `-`
- Reviewer: `-`
- Parent plan: `docs/AI_HANDOFF/PLAN.md` §2, §4 (manifest table), §7

## Goal

Contribute the new command `VSKit.runShellSelection` in `package.json` (command entry,
activation event, keybindings) and lock the manifest shape with tests in
`src/scaffold.test.ts`. Mirrors the existing `VSKit.runQuery` Cmd+Enter rows
(`when: editorTextFocus && resourceLangId == sql`) but scoped to `shellscript`.

## Target Files

- `package.json` — add to `contributes.commands`: `{ "command": "VSKit.runShellSelection", "title": "VSKit: Run Selection in Script Terminal", "category": "VSKit", "icon": "$(play)" }` (same shape as the `VSKit.runScript` entry); add `"onCommand:VSKit.runShellSelection"` to `activationEvents` (repo convention: every command lists one — see existing list); add 2 rows to `contributes.keybindings` (below).
- `src/scaffold.test.ts` — extend the existing manifest test (or add a sibling describe, style of lines 102-110 / 178-205): assert the new keybindings + command + activation event.

Keybinding rows (exact):

```json
{ "command": "VSKit.runShellSelection", "key": "cmd+enter", "mac": "cmd+enter",
  "when": "editorTextFocus && resourceLangId == shellscript" }
{ "command": "VSKit.runShellSelection", "key": "ctrl+enter", "win": "ctrl+enter",
  "linux": "ctrl+enter", "when": "editorTextFocus && resourceLangId == shellscript" }
```

## Test Cases (REQUIRED — TDD)

| # | Type | Test name | Expected | Pre-state / Fixture |
|---|------|----------|----------|---------------------|
| 1 | unit | keybindings contain `VSKit.runShellSelection` with mac `cmd+enter` | a row exists where `command==="VSKit.runShellSelection"`, `mac==="cmd+enter"`, `when==="editorTextFocus && resourceLangId == shellscript"` | read `package.json` as `src/scaffold.test.ts:73` already does |
| 2 | unit | command + activation event contributed | `contributes.commands` has the command with `title` starting `"VSKit: Run Selection"` and `activationEvents` contains `"onCommand:VSKit.runShellSelection"` and `"onLanguage:shellscript"` | same manifest fixture |
| 3 | edge (platform variant) | win/linux `ctrl+enter` variant exists | a row with `win==="ctrl+enter"` and `linux==="ctrl+enter"`, same `when` | same manifest fixture |
| 4 | edge (negative) | new shellscript binding does not clobber SQL rows | every `VSKit.runQuery` keybinding row still has `when` matching `/resourceLangId == sql/`; every `VSKit.runShellSelection` row matches `/shellscript/` | same manifest fixture |
| 5 | regression | existing TASK-605 + runQuery manifest assertions still pass | all pre-existing tests in `src/scaffold.test.ts` green unchanged | current file at base 86b034e |

## Test Files

- `src/scaffold.test.ts` — contains tests #1-#5 above (modify existing file; match its
  read-package.json + `expect(...)` style).

## Verification Commands

```bash
npx vitest run src/scaffold.test.ts
npm run typecheck
# Project has NO lint script (checked package.json scripts) — typecheck is the static gate.
# Wave-boundary regression net after BOTH SH tasks pass (run once):
npm test
```

## Acceptance Criteria

- [ ] All 5 test cases above pass (write test first, capture RED, then implement).
- [ ] `npm run typecheck` exits 0.
- [ ] No other manifest keys changed (no menus, no new views, no version bump).
- [ ] Existing `src/scaffold.test.ts` assertions unchanged and green.
- [ ] Reviewer verdict APPROVED or APPROVED-WITH-MINOR.

## Dependencies

- (none) — manifest-only change; `src/scaffold.test.ts` reads `package.json` directly and
  never imports `src/extension.ts`, so it passes before TASK-SH-002 lands.

## Interfaces

- Consumes: (none)
- Produces: command id literal `VSKit.runShellSelection` in `contributes.commands` +
  `activationEvents` + 2 keybinding rows with `when: editorTextFocus && resourceLangId == shellscript`.
  TASK-SH-002 registers a handler for this exact id in `src/extension.ts`.

---

## Discussion

### 2026-09-07 · planner · unic-smart
- Command palette entry is a deliberate byproduct of `contributes.commands` (matches
  `VSKit.runQuery`/`VSKit.runScript`); no editor/title menu this cycle per PLAN §2.
- No `selection`/code changes allowed here — TASK-SH-002 owns `src/extension.ts`.

## Executor Report

EXECUTOR_TOOL: Claude Code (claude CLI)
EXECUTOR_MODEL: claude-sonnet-4-5
EXECUTOR_SUBAGENT: feature-implementer

### Choice on activation event (per "smaller change" hint in task brief)

Repo convention: every command contributes its own `onCommand:VSKit.<id>` row in
`activationEvents` (the existing `VSKit.runScript` is paired with both
`onCommand:VSKit.runScript` AND `onLanguage:shellscript`). To follow that
convention AND keep both layers active, the manifest now has **three** shellscript
related activation events:

- `onLanguage:shellscript` (already existed)
- `onCommand:VSKit.runScript` (already existed)
- `onCommand:VSKit.runShellSelection` (added this task)

This is the smallest change consistent with the existing pattern — TASK-SH-002
later needs `onCommand:VSKit.runShellSelection` to register its handler before
the keybinding fires, and the per-command activation row is the cheapest way to
guarantee that.

### RED output (4 failing tests, baseline 7 passing)

```
 FAIL  src/scaffold.test.ts > scaffold > Test #1 (TASK-SH-001) — keybindings chứa VSKit.runShellSelection với mac cmd+enter (shellscript)
AssertionError: expected 0 to be greater than or equal to 1
  ❯ src/scaffold.test.ts:222:37

 FAIL  src/scaffold.test.ts > scaffold > Test #2 (TASK-SH-001) — command VSKit.runShellSelection + activation event được contribute
AssertionError: contributes.commands phải có VSKit.runShellSelection: expected undefined to be truthy
  ❯ src/scaffold.test.ts:236:91

 FAIL  src/scaffold.test.ts > scaffold > Test #3 (TASK-SH-001) — win/linux ctrl+enter variant tồn tại cho VSKit.runShellSelection
AssertionError: phải có row win=ctrl+enter cho VSKit.runShellSelection: expected undefined to be truthy
  ❯ src/scaffold.test.ts:258:76

 FAIL  src/scaffold.test.ts > scaffold > Test #4 (TASK-SH-001) — keybinding mới không clobber runQuery (SQL), đúng ngôn ngữ tách biệt
AssertionError: expected 0 to be greater than or equal to 2
  ❯ src/scaffold.test.ts:280:37

 Test Files  1 failed (1)
      Tests  4 failed | 7 passed (11)
```

All 4 fail for the expected reasons (no keybinding row, no command entry, no win/linux variant, no rows at all). TASK-605 regression tests + existing scaffold assertions remained green through the RED phase.

### Verification output (post-implementation)

#### `npx vitest run src/scaffold.test.ts`

```
 RUN  v1.6.1 /Volumes/KHOA_EXTENAL/DOCKER_CREATE/VSKit/.worktrees/task-sh-001

 ✓ src/scaffold.test.ts  (11 tests) 499ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  12:15:45
   Duration  658ms
```

#### `npm run typecheck`

```
> VSKit@1.53.18 typecheck
> tsc --noEmit
```

Exit 0, no errors.

### Manifest snapshot (post-change)

`activationEvents` shellscript-related rows:

```
"onCommand:VSKit.runScript",
"onLanguage:shellscript",
"onCommand:VSKit.runShellSelection",
```

`contributes.commands` new entry:

```json
{
  "command": "VSKit.runShellSelection",
  "title": "VSKit: Run Selection in Script Terminal",
  "category": "VSKit",
  "icon": "$(play)"
}
```

`contributes.keybindings` new rows (added directly below the existing two
`VSKit.runQuery` rows):

```json
{
  "command": "VSKit.runShellSelection",
  "key": "cmd+enter",
  "mac": "cmd+enter",
  "when": "editorTextFocus && resourceLangId == shellscript"
},
{
  "command": "VSKit.runShellSelection",
  "key": "ctrl+enter",
  "win": "ctrl+enter",
  "linux": "ctrl+enter",
  "when": "editorTextFocus && resourceLangId == shellscript"
}
```

No other manifest keys touched: no menu additions, no views, no version bump.
`VSKit.runScript` whole-file behavior, its existing keybinding, and its
`editor/title` entry are all preserved unchanged.

### Files changed

- `/Volumes/KHOA_EXTENAL/DOCKER_CREATE/VSKit/.worktrees/task-sh-001/package.json` (+20 lines)
- `/Volumes/KHOA_EXTENAL/DOCKER_CREATE/VSKit/.worktrees/task-sh-001/src/scaffold.test.ts` (+78 lines)

`src/extension.ts` and `src/extension.test.ts` NOT touched (per task scope —
TASK-SH-002 owns those).

Status: PASS
Note: none

## Reviewer Verdict

VERDICT: APPROVED-WITH-MINOR
REVIEWER_MODEL: unic-smart
EXECUTOR_MODEL: claude-sonnet-4-5
VERIFICATION_RERUN:
  command: npm run typecheck; npx vitest run src/scaffold.test.ts; npm test (wave net)
  result: typecheck exit 0; scaffold 11/11 pass; full suite 250 files / 3743 tests pass, 0 failed (2 skipped)
TEST_PLAN_COVERAGE: all-followed (#1-#5; #5 via unchanged pre-existing 7 tests, all green)
FINDINGS:
  critical: none
  important: none
  minor:
    - src/adapters/__tests__/bq04SurfaceGuard.test.ts:87 and bqFollowupSurfaceGuard.test.ts:70 — alternation `key|keybinding|keybindings` relies on backtracking; empirically verified correct today (matches `"key":`/`"keybindings":`/`"keybinding":`; does NOT match `"keywords":`/`"keys":`/`"keyboard":`/`"key2":`/`"keybindingsFoo":`), but longest-first ordering (`keybindings|keybinding|key`) is the safer idiom for future edits.
    - src/adapters/__tests__/bq04SurfaceGuard.test.ts:87 — filter is line-based/depth-agnostic: a hypothetical top-level package.json `key`/`keybindings` field would also be dropped from the deps guard (theoretical; not a real npm manifest field; same pre-existing limitation as `command`/`title`).
NEXT_STATUS_FOR_INDEX: approved_minor
NOTES: All 5 test-plan cases implemented with real RED evidence (4 assertion failures whose line refs match the final test locations). Diff is a pure manifest addition — no menus, no views, no version bump, no scope creep. Guard-fix is load-bearing: the BASE_REF (1ca64fa) package.json diff genuinely contains the new `"key":`/`"keybindings":` lines, and both guard tests pass in the full suite, proving the filter works.
