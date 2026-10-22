# Project Status

## Freshness

- Last meaningful update: 2026-10-22
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.14` is the current package at `dist/vskit-1.55.14.vsix`. The Generate Commit Message SCM button now uses the built-in `$(edit)` codicon (theme-colored, dark-mode visible) instead of the U-plus-sparkle SVG; command id, title, SCM menu, and handler are unchanged. Diagnostics remain opt-in and default-off.
- Verification: full release gate green (`npm test` 4,832 tests + `typecheck` + `compile`); packaged-manifest inside the final VSIX confirms `icon: "$(edit)"` and zero `commit-spark` references. Final VSIX: 2,279,410 bytes, SHA-256 `ef681af7dfdc0016266ee02e6852b27d281bc362b7ffed48eca42715022cc1e8`. Actual VS Code dark-mode icon UI verification remains pending for the owner.
- Distribution: GitHub release `v1.55.14` at https://github.com/lengockhoa/VSKit/releases/tag/v1.55.14 carries the verified VSIX; Marketplace publication remains paused. No runtime speedup is claimed.

## Active Work

- The full-suite gate ran green this cycle (the earlier 200 KB SQL parser timing-threshold failure did not recur).
- Owner follow-up: install `vskit-1.55.14.vsix` from GitHub release `v1.55.14` (or the one-line installer), switch VS Code to dark mode, open a Git repository, and confirm the Source Control title-bar button shows the pencil (`edit`) codicon with tooltip **VSKit: Generate Commit Message**. Runtime latency capture remains pending.

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
