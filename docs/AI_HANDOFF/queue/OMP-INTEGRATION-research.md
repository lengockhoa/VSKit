# Agent Runtime Integration Research

> Generated: 2026-08-23 (handoff Cycle L wave 1, scout agent) | Evidence-only, no speculation

## §Facts

### F1: omp is a native binary at `~/.local/bin/omp` (118.5 MB, Rust+N-API)
- Binary: self-contained darwin-arm64 executable.
- Version: 18.0.1 (from `~/.omp/agent/last-changelog-version`).
- Natives: `~/.omp/natives/18.0.1/pi_natives.darwin-arm64.node` (140 MB N-API addon — Rust core).
- Runtime data: `~/.omp/agent/` — config, model definitions, SQLite databases, sessions, extensions, and blob cache.
- License: MIT. Source: github.com/can1357/oh-my-pi (TypeScript + Rust).

### F2: the runtime has four programmatic surfaces
- **A — CLI headless**: `omp -p "prompt"` plain text stdout; `--mode json` streams JSON events; `--model <id>`; `--yolo --no-session`. Cold start 300-500ms per invocation. No tool callback.
- **B — RPC over stdio**: `omp --mode rpc --yolo --no-session`. Stdio JSONL. Client sends RpcCommand (prompt, steer, abort, set_model, set_host_tools, new_session, …); server emits RpcResponse + AgentSessionEvent stream (message_update/text_delta streaming, tool_execution_start/end). v2 framing for payloads up to 64 MB. `set_host_tools` lets the host register custom tools the agent calls back via host_tool_call frames. Canonical specification: upstream `docs/rpc.md`.
- **C — In-process SDK**: `@oh-my-pi/pi-coding-agent` `createAgentSession()` — requires **Bun 1.3.14+**, not Node.js → blocked for VS Code extension host (Node), would need a Bun worker process (architecturally equal to B but with an extra runtime dependency).
- **D — ACP**: `omp acp --yolo` — approval-aware alternative to RPC.

### F3: config system
- Global agent config: `modelRoles` (default, lightweight, and deep-reasoning roles), `tools.approvalMode: yolo`, `model.maxOutputTokens`.
- Provider configuration maps provider aliases to a base URL and API protocol; model aliases include vision-capable, coding, and lightweight variants (256k context, 32k output).
- Project agent config can override model roles and approval mode.
- Agent definitions use YAML frontmatter (name, description, model role, tools) with a Markdown system prompt.
- Skills are read from the project's skills directory by its discovery provider (no mirror needed).

### F4: install/upgrade
| Method | Command |
|---|---|
| curl script | `curl -fsSL https://omp.sh/install \| sh` |
| Homebrew | `brew install can1357/tap/omp` |
| npm (bun global) | `bun install -g @oh-my-pi/pi-coding-agent` |
| Self-update | `omp update` |
| Version | `omp --version` |

Natives are versioned directories (`~/.omp/natives/<version>/`). npm package (~17.2.x) lags binary (18.0.1).

### F5: Existing extension install/update story
- One command (README) installs the latest extension package from the project's release host. Idempotent.
- No post-install step for external tools. AI config currently manual via the extension's AI Settings command.

## §Options Compared

| Criterion | (a) spawn CLI prompt | (b) RPC server | (c) config-only reuse | (d) in-process SDK |
|---|---|---|---|---|
| Latency | 300-500ms/message | ~100ms first, ~0 after | ~0 (current) | ~200ms init |
| Streaming | no | **yes** (text delta) | yes (provider fetch) | yes |
| Persistence | session resume flags | **in-process + resume** | in-memory | full |
| Tools | runtime built-ins only | **host-tool bridge** | three built-in tools only | customTools |
| Errors | exit code | **structured RPC response** | ProviderError | structured |
| Upgrade coupling | tight | **medium (v1/v2 negotiation)** | none | tight (Bun sync) |
| Runtime req | binary on PATH | binary on PATH | none | **Bun 1.3.14+** ✗ |

## §Recommendation — Option (b): RPC bridge

Spawn the runtime in RPC mode as a long-lived child process. The bridge module is the RPC client + lifecycle (spawn/health/restart/session resume). Register the extension's database tools (`run_sql` read-only, `list_tables`, `describe_table`) through its host-tool registration API; the agent calls them back through host-tool frames. Chat panel streams text deltas into webview. **Fallback**: runtime missing/old/crashed → existing provider/agent path with a one-time notification pointing at install instructions.

Why: persistent process (no per-message cold start), real streaming, host-tool bridge keeps read-only guardrails in extension hands, the runtime's full tool surface + model routing, one-command runtime upgrade, no Bun dependency. (a) latency unusable; (c) discards runtime value; (d) blocked by VS Code Node host.

## §Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Agent runtime unavailable | High | Activation check for runtime version; fallback to existing AI + one-time install notice |
| Version skew | Medium | Minimum supported version (≥17.0.0 — host-tool support + v2 framing); runtime update command |
| Process crash | Medium | Monitor exit; auto-restart with session continuation; degrade gracefully |
| Agent file-system access | High | Working directory scoped to workspace; approval mode + shell pattern deny rules; document that the agent runtime mode grants workspace access |
| Two AI paths | Medium | Bridge isolates agent runtime path; shared AgentTool shape; existing provider path remains default fallback |

## §Open Questions (implementer decisions logged here)
1. Approval mode: start with explicit approval handling; richer protocol later.
2. Session history: read via the runtime's message API from its storage; don't duplicate.
3. Model UI: runtime model-selection RPC with user-chosen role; respect configured model roles.
4. Minimum supported runtime version: 17.0.0.
5. Tool schema: AgentTool.parameters passes through directly — smoke-test.
6. Degradation: spawn error → existing provider path; crash → banner + restart.
7. LSP: enabled by default (`--no-lsp` escape hatch).
