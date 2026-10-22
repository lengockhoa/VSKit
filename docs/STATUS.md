# Project Status

## Freshness

- Last meaningful update: 2026-10-22
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.12` is the owner diagnostic-capture package at `dist/vskit-1.55.12.vsix`, distinct from `1.55.11`. Diagnostics are opt-in. The monochrome U-plus-sparkle asset is included and matches the SVG source; actual VS Code icon UI and owner latency capture remain pending.
- Verification: `npm run verify:fast` passed; focused changed-path coverage passed 263/263 across 5 files; release hygiene passed 17/17; VSIX packaging and isolated-profile install passed. The final VSIX is 2,279,304 bytes, SHA-256 `c409a2c3de82271d05186642bd22de59e5d46d68502aa6fac05defba55d04529`; packaged command/default-off setting, extension bundle, and icon asset verified. Three earlier full-suite failures remain unexplained; full suite not rerun.
- Distribution: GitHub release `v1.55.12` carries this owner-test package. No Marketplace publish. The implementation code was already released as `v1.55.11`. No runtime speedup is claimed.

## Active Work

- Owner follow-up: transfer `dist/vskit-1.55.12.vsix` to the separate owner machine; run **Extensions: Install from VSIX...**; enable `VSKit.ai.commitGenDiagnostics`; generate one commit message; run **VSKit: Show Commit Message Diagnostics** and copy the `VSKit: Commit Message Diagnostics` log; capture the icon in VS Code. UI verification is pending: the isolated VS Code screenshot showed only the welcome page; Orca reported `window_not_focused` despite granted accessibility/screenshot permissions, so the target icon surface could not be reached. Runtime latency measurement remains pending.

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
