# PLAN — 2026-09-22: schema-tree table-node context menu order

## §1 Intent

The schema-tree table-node right-click menu must render `New Table…` as item
#1 and `Modify Table…` as item #2 of the extension group; every other
extension-group item keeps alphabetical-by-title order. Success = the ordering
contract holds in `package.json` `contributes.menus["view/item/context"]` and
is pinned by tests.

**Recovery:** the work was already implemented and committed in the recorded revision
(ancestor of HEAD) while its task file sat in
the archived task directory. This cycle recovers that task as
`TASK-001` and closes it out — executor verifies the landed contract is still
intact and green, fixing drift if found.

## §2 Scope

In scope:
- `package.json` — `"order": "1"` on the `newTable` command, `"order": "2"` on
  the `modifyTable` command in `view/item/context` (already landed).
- `src/extension.test.ts` — MENU describe block pinning the contract
  (already landed at ~L6007-6108).
- `src/adapters/__tests__/bq04SurfaceGuard.test.ts` — `order` in the
  contributes-key whitelist (already landed at L86).
- `CHANGELOG.md` — menu-promotion bullet (already landed under `[1.51.2]`,
  ~L674).

Out of scope: any other menu surface, version bump, commit/push/publish.

CONSTRAINT honored: single task, no same-file collisions possible.

## §3 Approach

Declarative VS Code menu ordering: `order` keys on the two entries sort them
ahead of unordered siblings (lexicographic ascending), which then fall back
to alphabetical-by-title. Alternatives rejected: a new menu group (changes
visual grouping, not just order); reordering the JSON array (VS Code ignores
declaration order within a group). Choice recorded: string `"1"`/`"2"` per VS
Code convention.

Because the implementation pre-exists this cycle, TASK-001 is a
verify-and-close task: run the pinned tests, confirm the diff surface matches
the spec exactly, and only re-edit if drift is found.

## §4 Test Plan

| Type | Test Name | Expected |
|------|-----------|----------|
| happy | MENU: newTable order "1" + when/group; modifyTable order "2" + when/group | exact `order`/`when`/`group` match on both entries |
| edge (structural) | exactly 2 extension-group entries carry `order`; 13 others do not | ordered set == {newTable, modifyTable}; e.g. analyzeTable/copyCreateDdl `order === undefined` |
| edge (behavioral) | simulated editor menu sort on table-node group | titles == ["New Table…", "Modify Table…", "Analyze Table", "Copy Create Query", "Insert Sample Data…", "Rename Column…", "Rename Table…", "Export Structure", "Postman Payload", "Vacuum Table"] |
| regression | bq04SurfaceGuard suite | 4/4 pass with `order` keys in working tree |

## §5 Verification

```bash
npx vitest run src/extension.test.ts -t "MENU"
npx vitest run src/adapters/__tests__/bq04SurfaceGuard.test.ts
npm test
npm run typecheck
npm run compile
```

Project has NO lint script (verified `package.json` scripts: compile, watch,
test, test:integration, typecheck, package, bump*, publish:*, verify:*,
profile:*, vscode:prepublish). `typecheck` + `compile` stand in for lint.

## §6 Acceptance

- [ ] `newTable` entry has `order: "1"`, `modifyTable` has `order: "2"`; both `when`/`group` byte-unchanged; no other package.json
      line touched. (See existing revision and current manifest entries.)
      current file L586-596.)
- [ ] All 3 MENU tests pass (`npx vitest run src/extension.test.ts -t "MENU"`).
- [ ] `bq04SurfaceGuard.test.ts` 4/4 pass.
- [ ] `npm test` green; `npm run typecheck` 0 errors; `npm run compile` clean.
- [ ] CHANGELOG bullet present (landed under `[1.51.2] — 2026-09-04`).
- [ ] No file outside {package.json, 2 test files, CHANGELOG.md} modified.

## §7 Global Constraints

- No version bump, no commit/push, no publish — maintainer-owned.
- No new dependencies; package-lock.json is hook-write-protected.
- `when` strings and `group` values byte-identical to current.
- Frozen surfaces (`bigqueryTypes.ts`, `bigqueryAdc.ts`, `src/adapters/types.ts`,
  dependency manifest) untouched — bq04SurfaceGuard enforces.
- Test comparator uses `"zzzz"` sentinel for missing `order` (lexicographic,
  no Number coercion).

## Planner Report

The plan was self-audited and reviewed; the implementation had already landed before this
cycle was recovered. The task is verify-and-close, not a new implementation.

## Plan Review Log

### Round 1 — 2026-09-22

Status: Approved

COMPLETENESS:
  - Requirements trace to landed manifest entries, tests, guard whitelist, and changelog.
CONSISTENCY:
  - The guard suite grew after this plan was drafted; report its actual count when verifying.
CLARITY:
  - Verification commands are exact; typecheck and compile are specified instead of lint.
SCOPE:
  - Single verify-and-close task; file set matches the landed change.
YAGNI:
  - No re-implementation planned; only drift-fix if found.

NOTES: Recovery and historical line references were checked. Current source is authoritative.
