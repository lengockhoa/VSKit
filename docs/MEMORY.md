# Project Memory

## Protocol

- **This is the most critical doc in the project.** Future AI sessions read this first to understand the system.
- **Source code is ground truth.** If this file contradicts source → source wins, update this file immediately.
- **After every non-trivial task**, ask: "What did I learn about this system?" → write it here if durable.
- Keep entries concise and actionable — future sessions must be able to act on this in seconds.
- Do NOT record temporary session notes here. Only durable knowledge.

## AI Filling Guide

<!-- When to write each section: -->
<!-- Architecture Decisions → any time a "why" is settled (tech choice, pattern, approach) -->
<!-- Active Constraints → any non-obvious rule AI must follow (security, layer boundaries, invariants) -->
<!-- Known Bugs → any bug investigated: root cause + pattern to watch, even if not yet fixed -->
<!-- Open Risks → deferred decisions, fragile areas, unresolved questions -->
<!-- Session Handoff → always update "Last worked on" before ending a session -->

## Architecture Decisions

<!-- WHY choices were made. Prevents future sessions from re-debating settled questions. -->
<!-- Format: [YYYY-MM-DD] Decision: X. Reason: Y. Do NOT change because: Z. -->
- [2026-09-09] Decision: Reuse the existing `openConsoleForObject` command for Schema Explorer connection/schema/category/table/view shortcuts. Reason: preserves the singleton Console, existing table/view SELECT seeding, active-schema pinning, and shared execution path without another command surface.

## Active Constraints

<!-- Rules AI must respect during implementation. Non-obvious limits not visible in the code. -->
- **Distribution status:** GitHub release `v1.55.12` carries `vskit-1.55.12.vsix`. Marketplace publishing remains paused; no Marketplace listing is verified.
- **Installer behavior:** `scripts/install-vskit.sh --local <file.vsix>` installs a supplied artifact. The no-argument path queries the latest GitHub release; `v1.55.12` has a matching asset. Verify future latest-release assets before relying on this path.
- **Persistence boundary:** VSKit does not import extension-scoped state or secrets from other installations. Configure connections and credentials in VSKit as needed; never read VS Code storage directories or create credential export files.
- **Build verification order:** typecheck → compile → tests → VSIX package. Compile first because some tests read generated `dist` bundles during module initialization. Inspect VSIX contents before distribution; do not install it or reload VS Code unless explicitly requested.
- **Release automation:** `.github/workflows/ci.yml` is verification-only. Follow the project-owner Git commit/push and versioned tag/release steps after local verification; Marketplace publishing remains paused. Do not treat package verification as a publish action.
- **AI engine setting:** Current configuration lives under `VSKit.ai.*`. Provider/model identifiers such as `omp`, `codex`, and `claude-code` are not product branding and remain unchanged.

## Known Bugs & Root Causes

- [2026-09-10] Generate Git message context bug: `collectCommitDiff()` chose one patch body (staged first, unstaged fallback) but previously combined file metadata from staged, working-tree, and merge state. The prompt could therefore list an unstaged file beside a staged-only patch, letting the model describe a change absent from the diff. The collector now selects matching metadata only (`indexChanges` for staged; `workingTreeChanges` + `mergeChanges` for unstaged fallback). Regression coverage is in `src/adapters/__tests__/gitDiff.test.ts`; keep diff body and file metadata from the same state group.

- [2026-08-25] Bug: user still saw `Error: column "ctid" does not exist` after cycle S was
  merged. Root cause: cycle S ended without a version bump/GitHub release, and the user's
  one-line installer pulls from latest Release — still v1.6.2 (pre-fix build).
  Fix applied: released v1.6.3 (bump + lockfile sync + tag + VSIX asset + install).
  Watch for: every handoff/pipeline cycle that changes user-visible behavior MUST end with a
  release (or an explicit queued next-cycle release task); releaseHygiene.test.ts now fails
  the build when package-lock version drifts — run `npm install --package-lock-only` after bumping.

- [2026-09-08] **CRITICAL SECURITY: packaged credential leak.** A local credential cache was included in a published package because the packager reads `.vscodeignore` (not `.gitignore`). Credentials were rotated and the ignore rule plus a regression guard were added. Any future local credential cache (API keys, OAuth refresh tokens, SSH keys, `.env`) MUST be added to `.vscodeignore` in the same change that creates it.

## Open Risks

<!-- Unresolved questions, known fragile areas, or deferred decisions. -->
<!-- Clear this entry once the risk is resolved. -->
- [2026-08-27] RESOLVED `pg-metadata-vs-transaction-window`: was ~11 metadata call sites on a
  `Pool({ max: 1 })` queueing behind a pinned manual-commit/cursor client and failing after
  connectionTimeoutMillis. Fixed by raising Postgres pool to `max: 4` (`PG_POOL_MAX`,
  postgres.ts connect()) — runQuery still holds ONE client per multi-statement script and
  beginTransaction() pins its own, so metadata lands on independent sessions. Regression test:
## Session Handoff
- Previous session completed the VSKit identity conversion and released `v1.55.7`; this follow-up shipped `v1.55.8` to GitHub. Marketplace remains paused. No VS Code install/reload or database service changes were performed.


- [2026-09-09] Decision: Keep the SQL Console editor dependency-free by layering `webview/sqlHighlight.ts` spans under a transparent native textarea. Reason: preserves native selection, clipboard, autocomplete, draft persistence, and keyboard behavior while adding file-like syntax coloring without introducing a heavyweight editor runtime.
- [2026-09-09] Constraint: The active namespace picker is shared across status bar, Console toolbar, and SQL file editor title menu. `ConnectionManager` reads the per-connection `ActiveSchemaStore` dynamically at execution time and prepends PostgreSQL `SET search_path`; do not duplicate namespace state in webviews or rewrite user SQL.

- [2026-09-17] Historical policy required Marketplace publication each cycle. Superseded on 2026-10-20; Marketplace publishing is paused. See Active Constraints.

## Completed Milestones

<!-- Significant shipped work. For historical context. One line per milestone. -->
<!-- Format: [YYYY-MM-DD] Milestone: X. Verified by: Y. -->
- [2026-08-27] v1.7.0 SQL Console — cycle Z full pipeline, suite 1693/0. Verified by: 3 bao-opus reviews + aggregate vitest + vsix artifact assertions.
- [2026-08-27] v1.6.8 results/query hardening — cycle Y, keyset paging + manual-commit UI + atomic MySQL batches. Verified by: 8 bao-opus reviews, suite 1658/0.
- [2026-08-25] v1.6.3 lazy-ctid fix — first cycle to close the "merged ≠ shipped" gap via releaseHygiene gate. Verified by: one-liner install.

## Completed Milestones

<!-- Significant shipped work. For historical context. One line per milestone. -->
<!-- Format: [YYYY-MM-DD] Milestone: X. Verified by: Y. -->
