# Worklog archive

This archive retains durable implementation and regression lessons from earlier work. Release-specific package names, branded command/settings identifiers, artifact links, and repository URLs are intentionally omitted.

## 2026-08-31 — AI and database tooling

- Safe file operations use exact URI allowlists, workspace-trust gating, request-scoped expected-content binding, host-side compare-and-swap writes, and a computed diff before approval. Tests cover empty allowlists, denial envelopes, sentinel placement, races, and truncation.
- Database analysis tools use guarded identifiers, per-component degradation, structured outcome summaries that exclude row bytes, and explicit error-envelope handling. Tests caught multi-statement injection and accidental serialized-data exposure.
- Rename workflow separates pure analysis, catalog queries, and sequential execution with progress, cancellation, and partial-failure reporting. Quoted dotted names retain their parent object identity.
- Connection workspace work added folder grouping, read-only SQL classification, SSH tunnel validation and ownership checks, and connection-form fields. Fail-closed behavior and lifecycle edges were reviewed.
- Schema/data comparison supports directional schema changes and avoids data queries for keyless comparisons; a single-column unique non-null key is supported. Relationship exploration normalizes FK targets, caps graph degree, escapes SVG output, and clamps zoom.
- Grounded workspace context enforces selection and byte caps, excludes secrets and binary files, and provides line-ranged attribution. Search and grounding are wired across the supported agent registries.
- Reliability checks covered schema-context races, bounded hydration, stale completion responses, multiline offsets, SQL literals/comments, and catalog navigation. Keep regression tests on actual execution paths rather than private-field mutation.

## 2026-08-30 — SQL, import, and results workflows

- Data workbench imports separate parsing, mapping/dry-run, and transactional execution; database transaction queries bind values through the active client.
- SQL navigation shares a schema cache and supports catalog-backed completion, hover, definition, and reference lookup. Virtual-document identifiers use a dedicated scheme.
- Compare panels are preview-only and hand generated SQL off for review rather than applying it automatically.
- Results work added server-side sorting, filtering, and paging across PostgreSQL, MySQL, and SQL Server; positional ordering preserves duplicate projection names. Typed state carries dialect and column types, with guarded fallback parsing.
- Export quoting and blank predicates are dialect-aware. Paging preserves hidden primary-key projections only for eligible browse shapes; tests cover composite keys, null behavior, and cancellation.
- A webview debounce race caused aggregate-suite flakes; drain scheduled posts deterministically. Build and test harnesses should evaluate bundles once per suite and settle teardown timers.

## 2026-08-27–29 — Chat, console, and editor workflows

- The SQL console uses the shared statement execution flow, has no persistence between opens, and supports explicit save, keyboard execution, and an accessible dismissible context menu.
- Multi-statement results append into isolated tabs; per-tab distinct-value caches survive tab changes.
- SQL autocomplete has one service owning debounce, cancellation, sequencing, cache, and cooldown. Schema-only context excludes rows, history, and credentials; stale, malformed, cancelled, and unconfigured results resolve safely.
- AI Chat supports local slash commands, session resume, image attachment, and clipboard paste. Attachment limits and non-vision rejection are enforced before sending; byte-signature checks, safe text rendering, and error-path tests protect the flow.
- Mid-turn steering is delivered directly to the active engine where supported, with a bounded host queue for other engines. Preserve distinction between live steering and turn-boundary queued messages.

## 2026-08-24–26 — Query lifecycle and webview hardening

- Query cancellation must stop active driver work before reporting idle. PostgreSQL cancellation destroys/releases the cancelled connection; MySQL destroys the active connection; SQL Server invalidates request generations and reconnects lazily.
- Multi-statement execution uses a timeout watchdog and abort seam so the first query error cannot leave later work hanging. Cleanup remains bounded.
- PostgreSQL view browsing fetches tuple identifiers lazily, avoiding invalid eager wrapping of views without that system column.
- The approval-aware agent bridge uses JSON-RPC/NDJSON, explicit Allow/Deny, and default-deny on timeout, stop, disposal, replacement, and process exit. Probe real protocol envelopes rather than guessing methods or fields.
- Streaming parsers must handle CRLF and preserve abort errors; stop and provider failures have distinct rendering paths. Drain pending webview timers during teardown to prevent post-test window access.
- Webview safety relies on text-only rendering of untrusted content, explicit layout rows, one transcript scroll owner, and tests that prove observable behavior rather than implementation details.

## 2026-08-23–24 — Core validation and execution patterns

- Read-only SQL classification must account for nested statements, EXPLAIN preambles, and common table expressions. Keep guard ordering explicit so early-return branches cannot bypass later checks.
- Text truncation should respect Unicode code-point boundaries, including lone-surrogate regression cases.
- SQL parsing and execution preserve bound parameters and session affinity. Transactional edit flows must pin a connection to avoid pool deadlocks and refresh state before acknowledging completion.
- Permission details redact secret keys, render SQL previews as text, and cap displayed JSON. Tool-call events are observable before execution without adding abort checks inside unsafe points.
- Schema and file operations use closed-world allowlists and fail closed on malformed input. A passing focused test is not enough when integration wiring or generated bundles can omit behavior.

## Durable process lessons

- Keep SQL identifiers guarded separately from bound values; parameterization does not make identifiers safe.
- Test race fixes with deferred operations and meaningful ordering; resolving the first operation too early can hide a leak.
- Return the stored promise when promise identity is part of single-flight coalescing; an `async` wrapper changes identity.
- Set disposal state synchronously before awaiting cleanup. Verify cancellation, stale-event, and post-disposal behavior through real registered callbacks.
- Avoid broad copy-back or cleanup commands that can discard ignored files or executor reports. Inspect the exact changed-file set before transferring work.
