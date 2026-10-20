# SPEC — MENU: schema-tree table-node context menu order (New Table #1, Modify Table #2)

<!--
Written by the planner at handoff-create (P2). Executor implements without
guessing: exact paths, signatures, frozen strings, thresholds, test
expectations. Open questions resolved in §14.
Cycle: menu-order-2026-09-22 · Base: main
-->

## 1. Problem and context

The schema-tree right-click menu on a table node
lists every extension-group entry alphabetically by command title, so
`Analyze Table` renders first and the two most common actions — `New Table…`
and `Modify Table…` — are buried mid-list. The user asked to promote both to
the top ("Đưa cả hai lên đầu"): `New Table…` as item #1, `Modify Table…` as
item #2, all other extension-group items keeping their alphabetical relative
order.

**Recovery note (2026-09-22):** this spec was already implemented and committed
in an earlier revision while its task file sat in the archived task directory.
This cycle recovers that task as `TASK-001` and closes it out: the executor
verifies the landed contract is still intact and green, and fixes any drift found.

## 2. Goals

- G1: On a table node's context menu, `New Table…` is item #1 and
  `Modify Table…` is item #2 of the extension group.
- G2: Every other extension-group entry keeps alphabetical-by-title order
  (no `order` key on any other entry).
- G3: The ordering contract is pinned by tests so a future manifest edit
  cannot silently regress it.

## 3. Non-goals

- NO new menu group, no reordering of the `inline` group or `view/title`.
- NO command/title/when changes — `when` strings and `group` values stay
  byte-identical.
- NO version bump, no commit/push, no publish (maintainer-owned).
- NO changes outside {package.json, the 2 test files, CHANGELOG.md}.

## 4. User journeys

- Right-click a table node in the schema tree → context menu opens →
  first extension-group item is `New Table…`, second is `Modify Table…`, then
  `Analyze Table`, `Copy Create Query`, `Insert Sample Data…`,
  `Rename Column…`, `Rename Table…`, `Export Structure`,
  `Postman Payload`, `Vacuum Table` in alphabetical order.
- Right-click a schema/category node → `New Table…` still appears (its `when`
  covers schema|category|table); `Modify Table…` does not (table-only `when`).

## 5. Functional requirements

- FR-001: `contributes.menus["view/item/context"]` entry for
  `newTable` carries `"order": "1"`, the extension group, and the existing
  schema/category/table visibility condition.
- FR-002: entry for `modifyTable` carries `"order": "2"`, the extension
  group, and the existing table-only visibility condition.
- FR-003: exactly those two extension-group entries have an `order` key; all
  other extension-group entries have `order === undefined`.
- FR-004: `bq04SurfaceGuard.test.ts` `contributesKeyPattern` whitelist
  includes `order` so the frozen-surface guard ignores the new keys.
- FR-005: CHANGELOG carries a "Changed"-style bullet describing the menu
  promotion (landed under `[1.51.2] — 2026-09-04`, line ~674).

## 6. Data / schema

N/A — declarative manifest change only; no runtime data or schema.

## 7. API / interfaces

- Produces: manifest context-menu entries for `newTable` and `modifyTable`, with ordering values `"1"` and `"2"` and their existing visibility conditions/group.
- Consumes: nothing; no runtime symbol involved.

## 8. UI / UX states

- Table node: ordered items first (`order` ascending, lexicographic), then
  unordered items alphabetical by title — VS Code's documented same-group
  comparator.
- Empty/error states: N/A — VS Code renders the menu; no extension code runs.

## 9. Permissions

N/A — no auth/permission surface.

## 10. Migration

N/A — no persisted state; ordering is read from the manifest at menu render.

## 11. Error handling

N/A — manifest-only change. Failure mode is a malformed `order` value, caught
by the MENU tests (exact string equality `"1"`/`"2"`).

## 12. Test expectations

- `src/extension.test.ts` `describe("MENU — table-node context menu: New Table #1, Modify Table #2")`
  (lines ~6015-6108): 3 tests — (a) exact order/condition/group match, (b) exactly 2 ordered entries in the extension group, (c) simulated editor sort produces expected title sequence.
  VS Code sort producing the expected title sequence.
- `src/adapters/__tests__/bq04SurfaceGuard.test.ts`: all 4 existing tests pass
  with `order` keys present in the working tree (whitelist already includes
  `order` at line 86).

## 13. Verification

```bash
npx vitest run src/extension.test.ts -t "MENU"
npx vitest run src/adapters/__tests__/bq04SurfaceGuard.test.ts
npm test
npm run typecheck
npm run compile
```

## 14. Open questions — resolved

- Q1: `order` value type → string `"1"`/`"2"` (VS Code lexicographic
  convention; `"10"` would sort before `"2"` under Number coercion, so the
  test comparator uses the `"zzzz"` sentinel for missing order).
- Q2: New group vs. `order` keys → `order` keys; a new group would change
  visual grouping, not just ordering.
- Q3: Already-landed work → verify-and-close rather than re-implement; the
  recorded earlier revision is an ancestor of `main` HEAD and the contract is intact.

## 15. Out of scope

- Any other menu surface (`view/title`, `editor/title`, webview contexts).
- Localization of menu titles.
- Ship pipeline (git push / release tag / vsce publish) — maintainer-owned,
  not part of this cycle.
