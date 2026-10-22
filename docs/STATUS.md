# Project Status

## Freshness

- Last meaningful update: 2026-10-22
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.11` is a local owner-test package at `dist/vskit-1.55.11.vsix`. Diagnostics are opt-in. Monochrome icon render checked at 16px/24px; actual VS Code UI and owner-side latency capture remain pending.
- Verification: fresh focused changed-path suites 83/83 and release hygiene 27/27 passed; `npm run typecheck`, `npm run compile`, and `npm run package -- --out dist/vskit-1.55.11.vsix` passed. An earlier `npm test` run passed (319 files, 4,827 tests; 2 files / 5 tests skipped), but three previously reported full-suite failures remain unexplained; the pass does not establish they were flaky. Full suite not rerun for this package refresh.
- Package: version `1.55.11`; SHA-256 `e017f0a7a08041e815f8272a9c0b0d468388f7006f52d8a31eca434378884ca9` (fresh `vsce package` with guard-trace tests; embedded bundle hash equals current `dist/extension.js` `e2600421bedc6f584b765f451ecad4e8a0ae82337c880decd868aaa7abc3eff8`, SVG asset `18bea04a684732499dcb8edc785d4480484c71fe3f26ea35bd6f68c581da77ba`). Packaged manifest has diagnostics default `false`, command `VSKit.showCommitMessageDiagnostics`, and the monochrome U-plus-sparkle icon.
- Distribution: Git commit/push, tag `v1.55.11`, and GitHub release with this VSIX asset were created. Marketplace publication is paused by owner instruction. No runtime speedup is claimed.

## Active Work

- Owner follow-up: transfer `dist/vskit-1.55.11.vsix` to the separate owner machine; run **Extensions: Install from VSIX...**; enable `VSKit.ai.commitGenDiagnostics`; generate one commit message; run **VSKit: Show Commit Message Diagnostics** and copy the `VSKit: Commit Message Diagnostics` log; capture the icon in VS Code. UI verification and latency measurement remain pending.

## Technical notes

- Commit generation diagnostics are metadata-only and must stay default-off. Keep phase timings and request correlation IDs; never log secrets, prompt, diff, source, or response.
- OMP retry lifecycle regression: the current guarded generation reuses one one-shot engine across attempt 1 and attempt 2, then disposes once; cancellation/timeout cleanup remains covered. No additional lifecycle change was warranted.

## Recent AI Chat maintenance

- Composer uses explicit grid-row placement to stay compact and pinned above the hint row; transcript remains the scroll region.
- Auto-scroll follows render updates while respecting user scroll-up and composer focus.
- Tool activity timeline uses status indicators, Bash input/output blocks, and text-only rendering.
- Copy/edit/retry/message menu actions use the live message snapshot and existing draft/retry flows.
- Relevant implementation areas: `webview/aiChat/`, `webview/aiChatPanelMain.ts`, and `src/ui/aiChatPanel.ts`.

## Technical notes

- Grid UI regressions can arise from CSS auto-placement when banners are hidden; pin explicit grid rows and test the computed layout contract.
- Streaming growth should drive auto-follow from the render pass and compare scroll distance before the frame to avoid false unread state.
- Render untrusted model/tool content with `textContent`; do not convert it to live HTML.
