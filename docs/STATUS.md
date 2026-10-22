# Project Status

## Freshness

- Last meaningful update: 2026-10-22
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.15` ships the measured Generate Commit Message (omp engine) speed fix: the one-shot `omp acp` spawn pins `defaultThinkingLevel: low` via a `--config` overlay for that process only and adds `--no-session`; `which omp`/`omp --version` are cached per activation; the ACP startup version probe runs parallel to the handshake; an omp build rejecting the flags falls back once without them (traced `omp.overlay.unsupported`).
- Verification: `bash scripts/build.sh` green end-to-end (typecheck + compile + 4,834 tests passed / 5 skipped + package). Final VSIX `dist/vskit-1.55.15.vsix`, 2,280,302 bytes, SHA-256 `e81c71eecbb2a3b7fba95017891ea0ca63670551ef756c19ed6671a498156ebc`; packaged manifest `lengockhoa.vskit` `1.55.15` with `VSKit.generateCommitMessage` intact.
- Distribution: GitHub release `v1.55.15` carries the verified VSIX; Marketplace publication remains paused.

## Active Work

- Owner follow-up: install `vskit-1.55.15.vsix` from GitHub release `v1.55.15` (or `bash scripts/install-vskit.sh --local <file>`), then re-test Generate Commit Message latency on the real machine with `VSKit.ai.commitGenDiagnostics` enabled if desired. Expected: a few seconds for small diffs (measured 2.1–3.5s omp turn + ~0.3–0.7s wiring on the dev machine; upstream floor 1.7–2.5s). User-machine numbers still pending — no claim about their exact upstream.
- If the user's configured engine is `builtin`, the flow was already a single bounded request; no changes were needed there.

## Technical notes

- Measurement evidence (dev machine, omp 18.12.5, unic-lite, 4-line diff, tiny repo): omp default `defaultThinkingLevel: high` → 4.2–7.5s/click; thinking `low` → 2.1–3.5s; raw single-shot request to the same model+input → 1.7–2.5s; warm session reuse does NOT help (history grows). VSKit wiring overhead per click ≈ 0.6–0.7s (spawn+handshake+session/new+teardown 20–35ms).
- Diff input stays capped at 12 KB (`GIT_DIFF_MAX_BYTES`); guard retry-once and 120s timeout/cancel semantics unchanged. No secrets, diff, or prompt content enters logs (metadata-only diagnostics, default-off).
- Full-suite run in this cycle had one unrelated timing-sensitive failure (`webviewServerSort` debounce race under parallel load) that passed 14/14 in isolation with zero webview files in the diff; the final build gate ran fully green.

## Technical notes

- Grid UI regressions can arise from CSS auto-placement when banners are hidden; pin explicit grid rows and test the computed layout contract.
- Streaming growth should drive auto-follow from the render pass and compare scroll distance before the frame to avoid false unread state.
- Render untrusted model/tool content with `textContent`; do not convert it to live HTML.
