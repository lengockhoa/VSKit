# Project Status

## Freshness

- Last meaningful update: 2026-10-20 22:03
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.8` is released on GitHub with asset `vskit-1.55.8.vsix` (23 files, 2.17 MB). Marketplace publication remains paused.
- Persistence: `lengockhoa.vskit` does not import prior global/workspace state or SecretStorage; existing extension data and Docker volumes remain untouched. No VS Code install/reload or database integration smoke test was run.
- Verification: typecheck and compile passed; full suite passed (319 files passed, 2 skipped; 4,812 tests passed, 5 skipped). Focused release-hygiene/resource guards passed (23/23), and filter/installer tests passed (17/17). Docker Compose config passed without starting services.
- Git: release commit `528b279` is on `origin/main`; tag `v1.55.8` and GitHub release/asset are verified. Historical `v1.55.6` and `v1.55.7` remain untouched; Marketplace was not published. User-owned `PROJECT_IMPORTANT.md` remains uncommitted.
- Local installation: `code --install-extension "$(pwd)/dist/vskit-1.55.8.vsix"`. It was not installed into the current VS Code.

## Active Work

- None. Marketplace publication, VS Code installation/reload, and database-service changes were not performed.

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
