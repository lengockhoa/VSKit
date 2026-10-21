# Project Status

## Freshness

- Last meaningful update: 2026-10-21 16:21
- Updated by: omp
- Status confidence: high
- Stale after: 72h

## Snapshot

- Focus: VSKit `1.55.10` is released on GitHub with `vskit-1.55.10.vsix` (23 files, 2.17 MB). Owner-side latency capture and real VS Code icon/UI verification remain pending.
- Persistence: `lengockhoa.vskit` does not import prior global/workspace state or SecretStorage; existing extension data and Docker volumes remain untouched. No VS Code install/reload or database integration smoke test was run.
- Verification: `npm run verify:fast` passed (`tsc --noEmit`, esbuild); the focused 7-file suite passed 326/326. Three previously reported full-suite failures remain unresolved and were not rerun; focused passes do not establish flakiness.
- Git: commit `100f3ba` is on `origin/main`; tag/release `v1.55.10` and its VSIX asset are created. Marketplace publication and VS Code installation/reload were not performed.
- Artifact: `dist/vskit-1.55.10.vsix`; SHA-256 `bf7e6828a134695b020152d13ab29dc2b9f60aff509b6c964d513df3a43b589d`.

## Active Work

- Owner-side validation pending: transfer/install the VSIX, enable diagnostics, generate one commit message, copy the Output Channel log, and capture a VS Code icon screenshot. No runtime latency improvement is claimed.

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
