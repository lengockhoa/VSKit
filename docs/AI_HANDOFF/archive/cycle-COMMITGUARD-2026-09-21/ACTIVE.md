Cycle: COMMITGUARD   Date: 2026-09-20   Base: main
Goal: Add validation and one retry for generated commit messages, rejecting hash-like or reasoning-leak output and requiring concise Vietnamese messages of at most 100 words.
Mode: Planning complete; executors pick `ready` tasks from INDEX.md in dependency order.
Spec: docs/AI_HANDOFF/SPEC.md
Plan: docs/AI_HANDOFF/PLAN.md
Queue: 3 ready tasks — docs/AI_HANDOFF/tasks/TASK-CG2-001.md → TASK-CG2-003.md
Status: planning_done — ready for executor
Next: wave 1 — TASK-CG2-001 + TASK-CG2-002 in parallel; then wave 2 — TASK-CG2-003 (deps: 001, 002).
Hard constraints: TypeScript/esbuild/vitest; pure module without `vscode`; do not change parser fallbacks, `sanitizeCommitMessage` semantics or `CommitGenDeps`; frozen strings/thresholds per SPEC §7/§8; no version bump/package/publish; reviewer model differs from executor model.
