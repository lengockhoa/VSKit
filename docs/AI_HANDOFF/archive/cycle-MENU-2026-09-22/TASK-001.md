# TASK-001 — Schema-tree table-node context menu: New Table #1, Modify Table #2

- Status: `ready`
- Owner: `-`
- Reviewer: `-`
- Parent plan: `docs/AI_HANDOFF/PLAN.md` §2-§4
- Spec references: `docs/AI_HANDOFF/SPEC.md` §5 FR-001…FR-005, §12

## Goal

Make the schema-tree table-node right-click menu render `New Table…` as item #1 and
`Modify Table…` as item #2 ("Move both to the top"), leaving every other extension-group item in
its current alphabetical relative order. Mechanism: two `order` keys in the manifest menu
contributions, plus the guard-whitelist extension that keeps the surface guard
green, plus tests pinning the ordering contract.

**Recovery note:** this task was recovered from an earlier archived task file. The implementation
was already committed in an earlier revision — see Discussion. Executor verifies the
landed contract is intact and green; only re-edit if drift is found.

## Target Files

- `package.json` — in `contributes.menus["view/item/context"]`: `"order": "1"` on the
  `newTable` entry and `"order": "2"` on the `modifyTable` entry (lines
  586-596; unique anchors below in Discussion). Nothing else in the file changes.
- `src/adapters/__tests__/bq04SurfaceGuard.test.ts` — `contributesKeyPattern`
  (line 86) must whitelist `order`:
  `/^[+-]\s+"(command|title|category|icon|when|group|order|key|keybinding|keybindings|mac|win|linux|light|dark)":/`
  so guard test 3 keeps filtering contributes lines with `order` keys present. This file
  is NOT frozen — only the listed type and dependency-manifest files are.
- `src/extension.test.ts` — describe block pinning the context-menu order
  contract (test cases below), landed at ~lines 6007-6108.
- `CHANGELOG.md` — menu-promotion bullet, landed in the relevant release section (~line 674).

## Test Cases (REQUIRED — TDD)

| # | Type | Test name | Expected | Pre-state / Fixture |
|---|------|-----------|----------|---------------------|
| 1 | happy | new-table item has order "1" and modify-table item has order "2" with existing conditions | both entries have exact order, condition and group values | `pkgJson`; RED before manifest edit (both entries lack `order`) |
| 2 | edge (structural) | exactly two extension-group entries carry `order`; 13 others do not | ordered commands are exactly `newTable` and `modifyTable`; e.g. analyze and copy-query entries have `order === undefined` | same fixture; RED before, GREEN after |
| 3 | edge (behavioral) | simulated editor sort on table-node group | ordered titles: `New Table…`, `Modify Table…`, then the remaining applicable actions in alphabetical order; schema/connection-only entries excluded | same fixture; RED before, GREEN after |
| 4 | regression (guard) | existing `bq04SurfaceGuard` suite still passes with `order` keys in the working tree | All 4 tests of `src/adapters/__tests__/bq04SurfaceGuard.test.ts` pass — test 3 (`package.json dependency manifest unchanged`) still drops contributes lines (incl. the `order` lines) and the sanity block still proves the wiring is live | Working tree with the package.json change applied; RED before the guard regex edit (guard test 3 fails on `+ "order": "1",` lines) |

Test-case #4 is verified by running the guard file (see Verification), not by a new test
function in this task's describe block. Test-case #3 comparator note: use the string
`"zzzz"` (or `order === undefined ? "zzzz" : order`) as the missing-order sentinel so the
comparator mirrors VS Code's "ordered first, unordered alphabetical after" without Number
coercion.

## Test Files

- `src/extension.test.ts` — `describe("MENU — ...")` block containing test cases 1-3
  (landed at ~lines 6007-6108).
- `src/adapters/__tests__/bq04SurfaceGuard.test.ts` — existing suite, whitelist regex
  includes `order` (test case 4).

## Verification Commands

```bash
# targeted ordering tests (RED/GREEN demonstrated in prior implementation)
npx vitest run src/extension.test.ts -t "MENU"
# regression — guard suite
npx vitest run src/adapters/__tests__/bq04SurfaceGuard.test.ts
# full suite — green, 3 MENU tests included
npm test
# typecheck (mandatory; project has NO lint script) + compile
npm run typecheck
npm run compile
```

## Acceptance Criteria

- [ ] Manifest context menu has exactly two `order` keys: `"1"` on `newTable`, `"2"` on `modifyTable`; both conditions and group values remain unchanged.
- [ ] All 3 ordering tests pass; RED/GREEN was demonstrated in the prior implementation — executor confirms current GREEN and re-verifies RED only if drift requires re-editing.
      current GREEN and re-verifies RED only if drift requires re-editing.
- [ ] `bq04SurfaceGuard.test.ts` passes (4/4) with the `order`-extended whitelist.
- [ ] `npm test` green with the 3 MENU tests included; skipped count unchanged.
- [ ] `npm run typecheck` 0 errors; `npm run compile` clean.
- [ ] `CHANGELOG.md` carries the menu-promotion bullet (landed under `[1.51.2] — 2026-09-04`).
- [ ] No file outside {package.json, the 2 test files, CHANGELOG.md} modified.

## Dependencies

- (none)

## Interfaces

- Consumes: `(none)` — declarative manifest change only; no runtime symbol used.
- Produces: manifest context-menu entries for `newTable` and `modifyTable`, with ordering values `"1"` and `"2"` and their existing visibility conditions/group. No later task consumes this; it is the user-facing deliverable.

---

## Discussion

### 2026-09-04 · planner

Verified before writing (do not re-derive):

- All 15 context-menu entries in the extension group sort alphabetically before the ordering keys are added.
- The test fixture uses the module-level manifest object; existing menu tests use the same fixture. Type checking excludes test files.
- String ordering values `"1"`/`"2"` follow the editor's lexicographic convention; no new group or declaration reorder.
- The surface guard filters contribution keys; whitelisting `order` is needed for its existing comparison to ignore these additions.
- No version bump or publishing in this cycle; maintainer-owned.

### 2026-09-22 · planner (recovery into this cycle)

Recovered from an earlier archived task as this cycle's TASK-001. The implementation had
already landed: both ordering keys, the guard whitelist extension, the three ordering tests,
and the changelog entry are present. This is therefore verify-and-close; confirm each
acceptance criterion against current files, fixing drift only if found.

The review noted the guard suite has grown since the plan was written. Current test counts
are determined by the current suite; verification commands remain unchanged.

### Planning and recovery notes

The four related files form one atomic change: the manifest edit requires its test pin, the
guard whitelist supports the manifest edit, and the changelog records the same user-facing
change. This task is verify-and-close, not fresh implementation.


(no comments yet)

## Executor Report

- Date: 2026-09-22 · Executor: ExecT1 (omp)
- EXECUTOR_TOOL: other (omp harness)
- EXECUTOR_MODEL: devin/swe-2
- EXECUTOR_SUBAGENT: ExecT1
- Status: PASS

### RED_OUTPUT

Feature pre-landed in `1e96f89` (confirmed ancestor of HEAD); tests verified GREEN — no
RED phase applicable. `npx vitest run src/extension.test.ts -t "MENU"`: 3 passed, 189
skipped (192 collected).

### Verification Output

- `npx vitest run src/extension.test.ts -t "MENU"` → 3 passed / 0 failed.
- `npx vitest run src/adapters/__tests__/bq04SurfaceGuard.test.ts` → 8 passed / 0 failed
  (suite has grown from 4 to 8 tests since the task was written; all green).
- `npm test` → 4822 passed, 5 skipped, 0 failed (322 files; 320 passed, 2 skipped).
- `npm run typecheck` → `tsc --noEmit` clean, 0 errors.
- `npm run compile` → esbuild clean: dist/extension.js 6.7mb, dist/webview.js 2.3mb.

### Acceptance criteria check

- `package.json` L586-596: `"order": "1"` on `VSKit.newTable` (L589), `"order": "2"` on
  `VSKit.modifyTable` (L595); `when`/`group` strings byte-unchanged. ✓
- `contributesKeyPattern` (guard test L86) whitelists `order`. ✓
- CHANGELOG bullet present: "Schema-tree table-node context menu now leads with New
  Table…, then Modify Table…" under `[1.51.2]`. ✓
- No source file modified by this executor; only this task file updated.

### Note

First `npm test` run showed 7 failed files / 2 failed tests — all environmental: the
worktree had no installed `node_modules` (only a `.vite` cache dir), so tests shelling
out to `node_modules/.bin/esbuild` (5 webview suites) and `node_modules/.bin/vsce`
(`vsixSecretsExclusion`) failed ENOENT. Fixed by symlinking the main checkout's
`node_modules` into the worktree (`ln -s ../../node_modules`); re-run is fully green.
No spec drift found; no code change needed.

## Reviewer Verdict

VERDICT: APPROVED-WITH-MINOR
REVIEWER_MODEL: devin/swe-2
EXECUTOR_MODEL: devin/swe-2 (self-reported, ExecT1)
VERIFICATION_RERUN:
  command: npx vitest run src/extension.test.ts -t "MENU"
  result: 3 pass / 0 fail (189 skipped)
  command: npx vitest run src/adapters/__tests__/bq04SurfaceGuard.test.ts
  result: 8 pass / 0 fail
  command: npm run typecheck
  result: 0 errors
TEST_PLAN_COVERAGE: all-followed — 3 MENU tests present at src/extension.test.ts:6015-6108 with real assertions (order values, when/group byte-equality, exact ordered-set, full sorted title list); guard suite covers test-case 4. RED_OUTPUT honestly reports no RED phase (feature pre-landed in 1e96f89; commit message documents original RED/GREEN) — acceptable for verify-and-close.
FINDINGS:
  critical: none
  important: none
  minor:
    - process: reviewer model == executor model (devin/swe-2). Per R2 isolation table this would normally be CHANGES-REQUESTED; per cycle instruction this verify-and-close task (zero new code, docs-only cycle diff) proceeds with the caveat recorded — human should note reduced independence of this review.
    - src/extension.test.ts:6009 — stale comment "pkgJson (line ~552)"; actual definition is ~L634. Cosmetic only.
NEXT_STATUS_FOR_INDEX: approved_minor
NOTES: Feature diff verified independently: package.json L586-596 carries exactly two order keys on the correct entries with when/group byte-unchanged; guard whitelist includes order; CHANGELOG bullet present at L674 under [1.51.2]. Cycle diff (54faa18..HEAD) touches only docs/AI_HANDOFF — no code drift.

## Model-Tier Guard Override

OVERRIDE_APPROVED_BY: human
REASON: This omp gateway resolves every model tier (@smol/@default/@slow) to the single available model devin/swe-2 — no distinct opus/unic-smart identity exists to author planning or review. Planner, executor, and reviewer were still run as three separate subagent invocations with fresh contexts, preserving review independence. Verify-and-close task: zero new code; reviewer re-ran verification independently (MENU 3/3, guard 8/8, typecheck clean).
