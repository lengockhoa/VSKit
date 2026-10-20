# Handoff INDEX

## Cycle COMMITGUARD — commit-message guard + retry cho Generate Commit Message

Feature cycle: Generated commit messages must reject hash-like or reasoning-leak output, retry once with a corrective prompt, and report an error if still invalid. Messages are in Vietnamese (English type prefix), subject ≤ 12 words, total ≤ 100 words. Plan and specification are in this archived cycle.
(Previous cycles STOPERR — 3/3 done and CHATFIX — complete; see their archived records.)

| Task | Title | Status | Dependencies | Wave |
|---|---|---|---|---:|
| TASK-CG2-001 | Pure guard module `commitMessageGuard.ts` (8 reason codes, frozen thresholds) | done (approved_minor — reviewer: bao-opus) | none | 1 |
| TASK-CG2-002 | SYSTEM_PROMPT tiếng Việt + `buildRetryCommitPrompt` trong `commitMessage.ts` | done (approved — reviewer: bao-opus) | none | 1 |
| TASK-CG2-003 | Wire guard + retry-1-lần vào `runGenerateCommitMessage` (3 branch) + docs | done (approved — reviewer: bao-opus) | 001, 002 | 2 |

Execution: wave 1 — CG2-001 + CG2-002 chạy song song (disjoint file sets: guard module
mới vs commitMessage.ts). Wave 2 — CG2-003 import cả hai interface, sở hữu
`commitGenCommand.ts` + test + user guide. Mỗi task TDD RED→GREEN: focused tests +
`npm run typecheck` + `npm run compile`; full `npm test` ở wave boundary. Reviewer model
PHẢI khác executor model. Task-budget validator: `VERDICT: ok` cho cả 3. No version bump,
package or publish (publish constraint ghi đè standing rule — orchestrator flag riêng).
