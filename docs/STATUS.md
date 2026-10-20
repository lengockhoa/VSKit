# Project Status

## Freshness

- Last meaningful update: 2026-10-20 20:38
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit identity conversion packaged as `dist/vskit-1.55.7.vsix`; version `1.55.7` avoids reusing the existing `v1.55.6` release.
- Persistence: the new `lengockhoa.vskit` identity does not import previous global/workspace state or SecretStorage; old extension data and Docker volumes remain untouched. No VS Code install/reload or database integration smoke test was run.
- Verification: typecheck, compile, full suite (319 files passed, 2 skipped; 4,812 tests passed, 5 skipped), targeted final suite (64 passed), Docker Compose config, and `git diff --check` passed.
- Git: `main` / `origin` point to VSKit; conversion changes remain local. The separate commit/push/tag/GitHub-release step is pending; Marketplace publishing remains paused.
- Local installation: `code --install-extension "$(pwd)/dist/vskit-1.55.7.vsix"`.

## Active Work

- Complete the versioned Git release sequence, then record the final remote state. Do not install/reload VS Code or publish to Marketplace.

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
