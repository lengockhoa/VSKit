# Project Status

## Freshness

- Last meaningful update: 2026-10-27
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.18` fixes truncated subjects (word-boundary clamp, safety cap 150, dangling-connector trim, complete 10–20 word Vietnamese sentence prompt, non-Latin glitch strip). Builds on 1.55.17, which makes Generate Commit Message speed-first (owner: speed > message quality). Hard model deadline `COMMIT_GEN_MODEL_DEADLINE_MS = 4_500`; on deadline / provider error / omp error / guard reject / no engine, an instant file-name subject (`chore: cập nhật a.ts, b.ts và N file khác`, docs/test type detection) is injected instead of an error. Change sets > `FILE_LIST_MODE_THRESHOLD` (20) files never call `repo.diff()` — prompt = file names + status counts + top dirs + file types (≤4 KiB); freshness for those snapshots hashes git state only. Raw diff capped at 256 KB before budgeting; `maxOutputTokens` 120. Deadline aborts the in-flight fetch / omp process. New trace events `engine.deadline`, `fallback.used`.
- Verification: `bash scripts/build.sh` green (4,787 tests passed / 4 skipped + package). VSIX `dist/vskit-1.55.18.vsix`, 2,282,949 bytes, SHA-256 `62b45196bf4f887c8c29bd6147e3dfcce2ac4f86d56aaeb9ae3e908d0cb6a50f`. Live omp-print timing with the new prompt: 2.3–3.6s typical, upstream spikes 5.5–8s observed (those clicks hit the 4.5s deadline → file-name fallback).
- Distribution: GitHub release `v1.55.18` carries the VSIX; Marketplace publication remains paused.
- Owner follow-up: install `vskit-1.55.18.vsix`; worst-case click is now bounded at ~5s (4.5s deadline + git/status) regardless of file count.
- Timeout root cause is closed with receipts: repro-before reproduced the verbatim 120000ms failure against HEAD `ee9fe3a` (`/tmp/commitgen-repro/ROOT-CAUSE.md` — unanswered ACP `session/request_permission` left the turn with no settle path); the replacement print port settles bounded on every failure path (exit / spawn error / timeout / abort), pinned by tests.

## Technical notes

- The commit-gen guard rejects only empty or clearly-non-commit output (blobs, reasoning markers); Vietnamese-ness, length, and style no longer trigger a second model call — there is no retry pass at all (single call per click).
- Git diff context: `GIT_DIFF_MAX_BYTES = 4_096` (was 12 KB), `MAX_COMMIT_FILES = 40`, `MAX_COMMIT_PATH_CHARS = 100`; bytes are the budget unit (no token estimation). Host ceiling `COMMIT_GEN_TIMEOUT_MS` 120s still bounds the whole click; the print port itself caps at `--max-time 100`.
- No secrets, diff, or prompt content enters logs (metadata-only diagnostics, default-off). stderr content of the omp print child is never surfaced (tests pin this).

## Technical notes

- Grid UI regressions can arise from CSS auto-placement when banners are hidden; pin explicit grid rows and test the computed layout contract.
- Streaming growth should drive auto-follow from the render pass and compare scroll distance before the frame to avoid false unread state.
- Render untrusted model/tool content with `textContent`; do not convert it to live HTML.
