# Project Status

## Freshness

- Last meaningful update: 2026-10-27
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.16` ships the Generate Commit Message speed rework: ONE model call per click, ONE short line output (8–16 words, max 72 chars, Vietnamese preferred, Conventional Commits prefix when it fits); routing decoupled from the chat engine — `builtin-direct` (provider request via the configured backend + Lite model) preferred, `omp -p` print-mode one-shot fallback (`--thinking low --no-tools --no-extensions --no-skills --no-rules --no-session`, internal `--max-time 100`); the ACP one-shot behind the "omp did not finish within 120000" timeout is deleted. Git context capped at 4 KiB UTF-8 with file-count (40) and path-length (100) caps; generated/lockfile hunks suppressed when source files exist. Diagnostics record the actual route per click.
- Verification: `bash scripts/build.sh` green end-to-end (npm ci + typecheck + compile + 4,777 tests passed / 4 skipped + package). Final VSIX `dist/vskit-1.55.16.vsix`, 2,279,646 bytes, SHA-256 `70dbe8b0af1f52e62ed78b4314ee128f876cc62482186720d5fc7236b1831bef`; packaged manifest `lengockhoa.vskit` `1.55.16` with `VSKit.generateCommitMessage` intact (`$(edit)` icon).
- Distribution: GitHub release `v1.55.16` carries the verified VSIX; Marketplace publication remains paused.

## Active Work

- Owner follow-up: install `vskit-1.55.16.vsix` from GitHub release `v1.55.16` (or `bash scripts/install-vskit.sh --local <file>`), then re-test Generate Commit Message latency on the real machine with `VSKit.ai.commitGenDiagnostics` enabled if desired — the trace now names the route (`builtin-direct` vs `omp-print`) and keeps per-phase timings. No claim about user-machine upstream latency yet.
- Timeout root cause is closed with receipts: repro-before reproduced the verbatim 120000ms failure against HEAD `ee9fe3a` (`/tmp/commitgen-repro/ROOT-CAUSE.md` — unanswered ACP `session/request_permission` left the turn with no settle path); the replacement print port settles bounded on every failure path (exit / spawn error / timeout / abort), pinned by tests.

## Technical notes

- The commit-gen guard rejects only empty or clearly-non-commit output (blobs, reasoning markers); Vietnamese-ness, length, and style no longer trigger a second model call — there is no retry pass at all (single call per click).
- Git diff context: `GIT_DIFF_MAX_BYTES = 4_096` (was 12 KB), `MAX_COMMIT_FILES = 40`, `MAX_COMMIT_PATH_CHARS = 100`; bytes are the budget unit (no token estimation). Host ceiling `COMMIT_GEN_TIMEOUT_MS` 120s still bounds the whole click; the print port itself caps at `--max-time 100`.
- No secrets, diff, or prompt content enters logs (metadata-only diagnostics, default-off). stderr content of the omp print child is never surfaced (tests pin this).

## Technical notes

- Grid UI regressions can arise from CSS auto-placement when banners are hidden; pin explicit grid rows and test the computed layout contract.
- Streaming growth should drive auto-follow from the render pass and compare scroll distance before the frame to avoid false unread state.
- Render untrusted model/tool content with `textContent`; do not convert it to live HTML.
