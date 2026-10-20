# Handoff INDEX

| Task | Title | Status | Owner | Files |
|------|-------|--------|-------|-------|
| TASK-UX1-001 | Console opens from schema tree with no active editor (R6+R7) | done | 6 tests; schema-tree activation region only; existing esbuild ENOENT baseline | src/ui/consolePanel.ts, src/extension.ts, src/ui/__tests__/consolePanel.test.ts, src/extension.test.ts |
| TASK-UX1-002 | SQL generation on View/Routine nodes (R3+R4) | done | 7 tests; pure trailing-semicolon helper; object DDL handler gated by adapter capability; full suite and compilation passed | package.json, src/extension.ts, src/extension.test.ts, src/ui/consolePanel.ts |
| TASK-UX1-003 | Sample Data to console INSERT templates (R1) | done | 5 net tests; INSERT template helper; removed prior input/config gate; console opens with editable template and does not auto-execute | package.json, src/ui/tableCommands.ts, src/extension.ts, src/ui/__tests__/tableCommands.test.ts |
| TASK-UX1-004 | User guide icon and documentation (R2) | done | Vietnamese guide and content test restored; activation helper, documentation section, command/view entry, activation event, and preview handler added | package.json, src/extension.ts, src/extension.test.ts, user guide, src/ui/__tests__/userGuideContent.test.ts, README.md |
| TASK-UX1-005 | Filter dropdown Select All alignment (R5) | done | 7 tests; typecheck and compile passed | webview/styles.css, webview/main.ts, src/ui/__tests__/webviewSetFilter.test.ts |
| TASK-UX1-008 | Chat pending garble and left padding (R9+R10) | done | 30 layout tests; only chat-related selectors touched; existing esbuild spawn ENOENT baseline | webview/chatPanelMain.ts, webview/styles.css, src/ui/__tests__/chatLayoutCss.test.ts |
| TASK-UX1-006 | Results placement and guard-filter extension (R8a) | done | 10 tests; activation and configuration keys included in guard filter; default remains below | package.json, src/ui/resultsPanel.ts, src/ui/__tests__/resultsPanel.test.ts, src/adapters/__tests__/bq04SurfaceGuard.test.ts |
| TASK-UX1-007 | Settings gear on schema-tree title bar (R8b) | done | 6 tests; settings command and view title entry; native tree view needs no webview bridge | package.json, src/extension.ts, src/extension.test.ts |
| TASK-UX1-009 | Chat thinking row and streamed code blocks (R11) | done | 59 tests; append-only chat selectors; history replay spinner and multi-fence rendering issues fixed | webview/chatPanelMain.ts, webview/styles.css, src/ui/__tests__/chatPanelBundle.test.ts, src/ui/__tests__/chatLayoutCss.test.ts |
| TASK-UX1-010 | DDL/DML status card instead of empty grid (R12) | done | 21 tests; pure status-card helper; existing selection command unchanged; BigQuery path retains undefined kind | src/core/queryRunner.ts, src/extension.ts, src/ui/resultsGridModel.ts, webview/main.ts, webview/styles.css, src/core/__tests__/queryRunner.test.ts, src/ui/ddlStatusCard.ts (new), src/ui/__tests__/ddlStatusCard.test.ts (new) |
| TASK-UX1-011 | Debounced schema-tree refresh after queries (R13) | done | 13 net tests; full/tree/none impact classifier; debouncer with trigger/flush/cancel/latest; tree refresh only for relevant DML; activation lifecycle cancellation | src/extension.ts, src/core/schemaImpact.ts, src/core/__tests__/schemaImpact.test.ts, src/extension.test.ts |
| TASK-MENU-001 | Schema-tree table context menu ordering | done | Table creation and modification entries precede alphabetical remainder | package.json, src/extension.test.ts, src/adapters/__tests__/bq04SurfaceGuard.test.ts, CHANGELOG.md |
| TASK-OC4O-001..002 | Open Console for Object and Help Grid panel | done | Console context action and help panel implemented | package.json, src/extension.ts, src/ui/consolePanel.ts, src/ui/helpGrid.ts, src/ui/helpGridPanel.ts, webview/helpGridMain.ts, src/extension.test.ts, src/adapters/__tests__/bq04SurfaceGuard.test.ts |
| TASK-BQ04-001 | Additive dialect marker on StatementResult and setter in runStatements | done | | src/core/queryRunner.ts, src/ui/resultsGridModel.ts, src/extension.ts, src/core/__tests__/queryRunner.test.ts, src/core/bqDialect.ts (new) |
| TASK-BQ04-002 | Webview cell renderer dialect formatting | done | | src/ui/resultsGridModel.ts, webview/main.ts, src/ui/__tests__/resultsGridModel.test.ts |
| TASK-BQ04-003 | Frozen-surface guard test | done | | src/adapters/__tests__/bq04SurfaceGuard.test.ts (new) |

## Shipped prior cycles (v1.49.0 and earlier)

| Task | Title | Status | Release |
|------|-------|--------|---------|
| TASK-BQ04-001..003 | Wire dialect-aware cell formatting into Results grid | done | v1.51.0 |
| TASK-BQ03-001..005 | GoogleSQL query jobs and paged Results grid | done | v1.50.0 |
| TASK-BQ02-001..004 | BigQuery resource explorer and table preview | done | v1.49.0 |
| TASK-CL-001..004 | Cleanup: MSSQL bracket handling, cache invalidation, snapshot name cap | done | v1.48.0 |
| TASK-BQ01-001..004 | BigQuery connection foundation | done | v1.47.0 |
| TASK-BQ00-001..004 | BigQuery feasibility spike | done | v1.46.0 |
| ARP-09 | Redacted diagnostics and performance profiles | done | v1.45.0 |
| ARP-08 | Console draft recovery | done | v1.44.0 |
| ARP-07 | Successful-DDL cache/context invalidation | done | v1.43.0 |
