# TASK-MENU-001 — Schema-tree table-node context menu: New Table #1, Modify Table #2

- Status: `ready`
- Owner: `-`
- Reviewer: `-`
- Parent plan: `docs/AI_HANDOFF/PLAN.md` §2-§4

## Goal

Make the schema-tree table-node right-click menu render `New Table…` as item #1 and
`Modify Table…` as item #2 ("Đưa cả hai lên đầu"), leaving every other Extension-group item in
its current alphabetical relative order. Mechanism: two `order` keys in package.json menu
contributions, plus the one-word guard-whitelist extension that keeps the BQ04 surface guard
green, plus tests pinning the ordering contract.

## Target Files

- `package.json` — in `contributes.menus["view/item/context"]`: add `"order": "1"` to the
  `extension.newTable` entry and `extension.modifyTable` entry (lines ~467-476;
  unique anchors below in Discussion). Nothing else in the file changes.
- `src/adapters/__tests__/bq04SurfaceGuard.test.ts` — extend `contributesKeyPattern`
  (line 74) from
  `^[+-]\s+"(command|title|category|icon|when|group|keybinding|mac|win|linux)":/` to
  `^[+-]\s+"(command|title|category|icon|when|group|order|keybinding|mac|win|linux)":/`
  so guard test 3 keeps filtering contributes lines after `order` keys are added. This file
  is NOT frozen — only `bigqueryTypes.ts` / `bigqueryAdc.ts` / `src/adapters/types.ts` /
  the dependency manifest are.
- `src/extension.test.ts` — add one new describe block (`MENU`) at the end of the file
  pinning the ordering contract (test cases below). Precedent: the OC4O menu test at ~line
  4605 uses the same module-level `pkgJson` (defined at line 552).
- `CHANGELOG.md` — one "Changed" bullet under the existing `[1.51.1] — pending` heading.

## Test Cases (REQUIRED — TDD)

| # | Type | Test name | Expected | Pre-state / Fixture |
|---|------|-----------|----------|---------------------|
| 1 | happy | `MENU: extension.newTable has order "1" and extension.modifyTable has order "2"; when/group clauses match` | Both entries have the specified order, retain `view == extension.schemaTree` conditions, and use group `Extension` | `pkgJson`; RED before package edit because both `order` values are undefined |
| 2 | edge (structural) | `MENU: exactly two Extension-group entries have order; other entries keep alphabetical fallback` | Ordered-command set equals `extension.newTable` and `extension.modifyTable`; analyze/copy entries remain unordered | same `pkgJson`; RED before (set is empty), GREEN after |
| 3 | edge (behavioral) | `MENU: simulated editor sorting places New Table… then Modify Table… before remaining table actions` | Comparator sorts by explicit order then title; filtered table entries start with New Table… and Modify Table…, with other applicable commands retaining alphabetical order and non-table entries excluded | same `pkgJson`; RED before because Analyze Table sorts first |
| 4 | regression (guard) | existing `bq04SurfaceGuard` suite still passes with `order` keys in the working tree | All 4 tests of `src/adapters/__tests__/bq04SurfaceGuard.test.ts` pass — test 3 (`package.json dependency manifest unchanged`) still drops contributes lines (incl. the new `order` lines) and the sanity block still proves the wiring is live | Working tree with the package.json change applied; RED before the guard regex edit (guard test 3 fails on `+ "order": "1",` lines) |

Test-case #4 is verified by running the guard file (see Verification), not by a new test
function in this task's describe block. Test-case #3 comparator note: use the string
`"zzzz"` (or `order === undefined ? "zzzz" : order`) as the missing-order sentinel so the
comparator mirrors VS Code's "ordered first, unordered alphabetical after" without Number
coercion.

## Test Files

- `src/extension.test.ts` — new `describe("MENU — ...")` block containing test cases 1-3.
- `src/adapters/__tests__/bq04SurfaceGuard.test.ts` — existing suite, modified regex
  (test case 4).

## Verification Commands

```bash
# targeted — new MENU tests (RED before package.json edit, GREEN after)
npx vitest run src/extension.test.ts -t "MENU"
# regression — guard suite (RED before regex edit, GREEN after)
npx vitest run src/adapters/__tests__/bq04SurfaceGuard.test.ts
# full suite — baseline 3417 passed / 2 skipped + 3 new tests
npm test
# typecheck (mandatory; project has NO lint script) + compile
npm run typecheck
npm run compile
```

## Acceptance Criteria

- [ ] `git diff package.json` shows exactly two added lines: `"order": "1"` on the
      `extension.newTable` entry, `order: "2"` on the `extension.modifyTable` entry; both `when`
      strings and both generic group values byte-unchanged; no other line changed.
- [ ] All 3 new MENU tests pass; both were demonstrated RED against unmodified package.json
      before the edit and GREEN after.
- [ ] `bq04SurfaceGuard.test.ts` passes (4/4) after the regex extension.
- [ ] `npm test` green: 3417 pre-existing + 3 new, 2 skipped stays 2 skipped.
- [ ] `npm run typecheck` 0 errors; `npm run compile` clean.
- [ ] `CHANGELOG.md` has one "Changed" bullet under `[1.51.1] — pending`.
- [ ] No file outside {package.json, the 2 test files, CHANGELOG.md} modified.

## Dependencies

- (none)

## Interfaces

- Consumes: `(none)` — declarative manifest change only; no runtime symbol used.
  `{ command: "extension.newTable", when: "view == extension.schemaTree && (viewItem == schema || viewItem == category || viewItem == table)", group: "Extension", order: "1" }`
  and `{ command: "extension.modifyTable", when: "view == extension.schemaTree && viewItem == table", group: "Extension", order: "2" }`
  (exact current `when` strings, verified from package.json lines 467-476). No later task
  consumes this; it is the user-facing deliverable.

---

## Discussion

### 2026-09-04 · planner · unic-smart

Verified before writing (do not re-derive):

- Zero `order` keys exist anywhere in package.json today; all 15 `view/item/context`
  group `Extension` entries sort alphabetically. Raw anchors (package.json lines 467-476):
  the `newTable` menu entry ends with group `Extension` and the `modifyTable` entry
  ends with group `Extension` — each with the `when` strings quoted in §Interfaces.
  Suggested edit shape (unique because the full `when` strings are unique):
  append `order: "1"` to the `newTable` entry and `order: "2"` to the `modifyTable` entry.
- `package.json` scripts: `test`=`vitest run`, `typecheck`=`tsc --noEmit`,
  `compile`=`node esbuild.js`, `verify:release`=`npm test && npm run typecheck && npm run compile`.
  **There is no `lint` script** — do not invent one.
- The guard coupling is real and verified: `contributesKeyPattern` (line 74 of
  bq04SurfaceGuard.test.ts) whitelists `(command|title|category|icon|when|group|keybinding|mac|win|linux)`
  only, so `+        "order": "1",` survives the filter and guard test 3 fails. Extending the
  whitelist with `order` is the same move as the v1.51.0 "filter tightened" change.
- Idiomatic test location chosen: `src/extension.test.ts` (module-level `pkgJson` at line
  552; precedent menu tests at 580, 1767, 2085, 4605 — the OC4O cycle added its menu test
  there rather than a new file). tsconfig excludes `**/*.test.ts` from typecheck include, so
  typecheck is unaffected by the new tests either way.
- Choice recorded per plan §3: string `"1"`/`"2"` order values (VS Code lexicographic
  convention), no new group, no declaration reorder.
- CHANGELOG bullet goes under the already-pending `[1.51.1] — pending` entry; no version bump,
  no commit/push in this cycle (maintainer-owned; package-lock.json is hook-write-protected).


### 2026-09-22 · planner · unic-smart

SUPERSEDED — recovered into cycle MENU-2026-09-22 as `docs/AI_HANDOFF/tasks/TASK-001.md`.
The implementation described here already landed in commit `1e96f89`; the recovered task
is verify-and-close. Anchors in this file are stale (drift corrections recorded in
TASK-001 Discussion). Do not execute this file directly.
(no comments yet)
