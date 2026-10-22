# Project Status

## Freshness

- Last meaningful update: 2026-10-22
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.13` is the owner diagnostic-capture package at `dist/vskit-1.55.13.vsix`. Diagnostics are opt-in; the package contains the U-plus-separated-sparkle SVG. Packaged version, command, default-off setting, owner instructions, and icon/source hash match are verified. Actual VS Code icon UI and owner latency capture remain pending.
- Verification: focused commit-generation tests passed 47/47 across 3 files; `npm run typecheck` and `npm run compile` passed. The single `npm run verify:release` attempt ran the full suite and failed the 200 KB SQL parser timing threshold (53.47 ms vs <50 ms); 318 test files passed and 2 were skipped. Earlier full-suite failures remain undetermined; no rerun or flaky-test conclusion. Final VSIX: 2,279,284 bytes, SHA-256 `ea9dd821402ba8c8f7e5bd0a4c3f1090cf2dd58b28a0a9ffe6cfc80284eb1db7`.
- Distribution: package is ready for owner transfer; Marketplace publication remains paused. No speedup is claimed.

## Active Work

- The full-suite gate is not green because of the 200 KB SQL parser timing threshold; its cause remains undetermined and no rerun was performed. Focused commit-generation tests, typecheck, compile, and final VSIX checks passed.
- Owner follow-up: transfer the final `.vsix` to the separate owner machine; run **Extensions: Install from VSIX...**; enable `VSKit.ai.commitGenDiagnostics`; generate one commit message; run **VSKit: Show Commit Message Diagnostics** and copy the `VSKit: Commit Message Diagnostics` Output Channel; capture the icon in VS Code. UI verification and runtime latency measurement remain pending.

## Technical notes

- Commit generation diagnostics are metadata-only and must stay default-off. Keep phase timings and request correlation IDs; never log secrets, prompt, diff, source, or response.
- OMP retry lifecycle regression was reproduced against pre-fix code and passes against current code: one engine is reused across guard retries and disposed once after the guarded flow; cancellation/timeout cleanup remains covered.

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
