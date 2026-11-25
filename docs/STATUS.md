# Project Status

## Freshness

- Last meaningful update: 2026-10-27
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.19` — `VSKit: Export Structure` on a schema's **Tables** folder exports every table (table node → that table) as migration-ready PostgreSQL DDL: defaults, identity/generated columns, PK/UNIQUE/CHECK/EXCLUDE, all indexes (partial/expression/any method), FKs with actions emitted last via `ALTER TABLE … ADD CONSTRAINT`, sequences + `OWNED BY`, partitions, comments. Export All Structures and the agent `export_structure` tool share it (`src/core/ddl/pgStructure.ts` + `CatalogApi.schemaStructure` + `collectStructureSql`). Fixed `objectDdl("view")` regclass cast. Tables folder uses tree context key `category-tables` (internal node contextValue stays `category`).
- Verification: live PG15 replay of the export into an empty DB succeeded and re-export was identical; `bash scripts/build.sh` green (4,795 passed / 4 skipped). VSIX `dist/vskit-1.55.19.vsix`, 2,288,061 bytes, SHA-256 `c1386f9d3f09e10cf98cf783e029600347b8f78351a3df0fefc5ee79b36261c1`.
- Distribution: GitHub release `v1.55.19` carries the VSIX; Marketplace publication remains paused.
- Owner follow-up: install `vskit-1.55.19.vsix`; right-click **Tables** → `VSKit: Export Structure`.
- Timeout root cause is closed with receipts: repro-before reproduced the verbatim 120000ms failure against HEAD `ee9fe3a` (`/tmp/commitgen-repro/ROOT-CAUSE.md` — unanswered ACP `session/request_permission` left the turn with no settle path); the replacement print port settles bounded on every failure path (exit / spawn error / timeout / abort), pinned by tests.

## Technical notes

- The commit-gen guard rejects only empty or clearly-non-commit output (blobs, reasoning markers); Vietnamese-ness, length, and style no longer trigger a second model call — there is no retry pass at all (single call per click).
- Git diff context: `GIT_DIFF_MAX_BYTES = 4_096` (was 12 KB), `MAX_COMMIT_FILES = 40`, `MAX_COMMIT_PATH_CHARS = 100`; bytes are the budget unit (no token estimation). Host ceiling `COMMIT_GEN_TIMEOUT_MS` 120s still bounds the whole click; the print port itself caps at `--max-time 100`.
- No secrets, diff, or prompt content enters logs (metadata-only diagnostics, default-off). stderr content of the omp print child is never surfaced (tests pin this).

## Technical notes

- Grid UI regressions can arise from CSS auto-placement when banners are hidden; pin explicit grid rows and test the computed layout contract.
- Streaming growth should drive auto-follow from the render pass and compare scroll distance before the frame to avoid false unread state.
- Render untrusted model/tool content with `textContent`; do not convert it to live HTML.
