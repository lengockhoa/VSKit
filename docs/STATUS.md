# Project Status

## Freshness

- Last meaningful update: 2026-10-20 20:42
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit identity conversion complete; GitHub release `v1.55.7` carries `vskit-1.55.7.vsix` (23 files, 2.17 MB).
- Persistence: `lengockhoa.vskit` does not import prior global/workspace state or SecretStorage; old extension data and Docker volumes remain untouched. No VS Code install/reload or database integration smoke test was run.
- Verification: typecheck and compile passed; full suite (319 files passed, 2 skipped; 4,812 tests passed, 5 skipped); focused final suite (64 passed); Compose config and shell checks passed.
- Git: conversion commit `bbab82b` is pushed to `origin/main`; tag `v1.55.7` and its GitHub release are created. Historical `v1.55.6` and its artifact remain untouched; no Marketplace publish.
- Local installation: `code --install-extension "$(pwd)/dist/vskit-1.55.7.vsix"`. It was not installed into the current VS Code.

## Active Work

- None; the local VSIX is ready for user testing. No release or install work remains.

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
