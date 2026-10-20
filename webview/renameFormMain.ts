// webview/renameFormMain.ts — TASK-DBX06-003 + DBX06-006
// Webview entry cho RenameForm — minimal safe-rename dialog.
// Vanilla DOM only (textContent/createElement — no innerHTML sinks).
// Protocol mirror src/ui/renameFormMessages.ts.
import type {
  RenameFormHostMessage,
} from "../src/ui/renameFormMessages";

declare const acquireVsCodeApi: undefined | (() => {
  postMessage: (msg: unknown) => void;
});
const vscodeApi =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

function post(msg: unknown): void {
  vscodeApi?.postMessage(msg);
}

interface State {
  mode: "table" | "column";
  schema: string;
  table: string;
  oldName: string;
  approved: boolean;
}

let state: State = {
  mode: "table",
  schema: "",
  table: "",
  oldName: "",
  approved: false,
};

const root = document.getElementById("VSKit-root") as HTMLDivElement;

// ---- DOM helpers (textContent only — CSP/scaffold safe) --------------------

function el(
  tag: string,
  className?: string,
  text?: string,
): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function line(e: HTMLElement, text: string): void {
  e.appendChild(el("div", "VSKit-rename-line", text));
}

function humanLabelForStep(kind: string): string {
  // Typed step label surfaced in the review pane. Match the host-side label
  // so what the user sees in the preview lines up with the progress/done
  // report (which uses the raw `kind`).
  switch (kind) {
    case "rename":
      return state.mode === "column" ? "Rename column" : "Rename table";
    case "views":
      return "Views to review";
    case "fks":
      return "Foreign keys to review";
    case "routines":
      return "Routines to review";
    case "triggers":
      return "Triggers to review";
    case "indexes":
      return "Indexes to review";
    default:
      return kind;
  }
}

// ---- render ----------------------------------------------------------------

function renderInit(): void {
  root.textContent = "";
  const form = el("div", "VSKit-rename-form");

  const title = el(
    "h2",
    "VSKit-rename-title",
    `Rename ${state.mode} — ${state.schema}.${state.table}`,
  );
  form.appendChild(title);

  const row = el("div", "VSKit-rename-row");
  row.appendChild(
    el("label", "VSKit-rename-label", `New ${state.mode} name for "${state.oldName}":`),
  );
  const input = el("input", "VSKit-rename-input") as HTMLInputElement;
  input.type = "text";
  input.id = "VSKit-rename-input";
  input.value = state.oldName;
  row.appendChild(input);
  form.appendChild(row);

  const analyzeBtn = el("button", "VSKit-rename-analyze", "Analyze");
  analyzeBtn.id = "VSKit-rename-analyze";
  analyzeBtn.addEventListener("click", () => {
    post({ type: "analyze", newName: input.value });
  });
  form.appendChild(analyzeBtn);

  const approveBtn = el("button", "VSKit-rename-approve", "Approve & Run");
  approveBtn.id = "VSKit-rename-approve";
  approveBtn.disabled = true; // enabled only after a clean analysis
  approveBtn.addEventListener("click", () => {
    state.approved = true;
    post({ type: "approve" });
  });
  form.appendChild(approveBtn);

  const cancelBtn = el("button", "VSKit-rename-cancel", "Cancel");
  cancelBtn.id = "VSKit-rename-cancel";
  cancelBtn.addEventListener("click", () => {
    post({ type: "cancel" });
    form.appendChild(el("div", "VSKit-rename-status", "Cancelling…"));
  });
  form.appendChild(cancelBtn);

  const analysis = el("div", "VSKit-rename-analysis");
  analysis.id = "VSKit-rename-analysis";
  form.appendChild(analysis);

  const progress = el("div", "VSKit-rename-progress");
  progress.id = "VSKit-rename-progress";
  form.appendChild(progress);

  root.appendChild(form);
}

interface AnalysisPayload {
  report: {
    views: Array<{ name: string; kind: string }>;
    fks: Array<{ constraint: string; fromTable: string }>;
    routines: Array<{ name: string }>;
    triggers: Array<{ name: string; event: string; timing: string }>;
    indexes: Array<{
      name: string;
      isPrimary: boolean;
      isUnique: boolean;
      columns: string[];
    }>;
    collisions: string[];
  };
  statements: string[];
  steps: Array<{ kind: string; executable: boolean; statement: string }>;
  errors: string[];
}

function renderAnalysis(payload: AnalysisPayload): void {
  const box = document.getElementById(
    "VSKit-rename-analysis",
  ) as HTMLDivElement | null;
  if (!box) return;
  box.textContent = "";

  const approveBtn = document.getElementById(
    "VSKit-rename-approve",
  ) as HTMLButtonElement | null;

  if (payload.errors.length > 0) {
    for (const e of payload.errors) line(box, `Error: ${e}`);
    if (approveBtn) approveBtn.disabled = true;
    return;
  }

  const r = payload.report;
  const usage =
    r.views.length +
    r.fks.length +
    r.routines.length +
    r.triggers.length +
    r.indexes.length;
  line(box, `Usage: ${usage} object(s) reference this ${state.mode}.`);
  for (const v of r.views) line(box, `View: ${v.name} (${v.kind})`);
  for (const f of r.fks) line(box, `FK: ${f.constraint} from ${f.fromTable}`);
  for (const rt of r.routines) line(box, `Routine: ${rt.name}`);
  for (const tr of r.triggers) {
    line(box, `Trigger: ${tr.name} (${tr.timing} ${tr.event})`);
  }
  for (const ix of r.indexes) {
    line(
      box,
      `Index: ${ix.name}${ix.isPrimary ? " [PK]" : ""}${ix.isUnique ? " [U]" : ""}`,
    );
  }
  for (const c of r.collisions) line(box, `Collision: ${c}`);

  const steps = el("div", "VSKit-rename-steps");
  steps.id = "VSKit-rename-steps";
  for (const s of payload.steps) {
    if (s.executable) {
      line(steps, `${humanLabelForStep(s.kind)}: ${s.statement}`);
    } else {
      line(steps, `${humanLabelForStep(s.kind)} (review only)`);
    }
  }
  box.appendChild(steps);

  if (approveBtn) approveBtn.disabled = payload.statements.length === 0;
}

interface ProgressPayload {
  index: number;
  total: number;
  statement: string;
}

function renderProgress(payload: ProgressPayload): void {
  const box = document.getElementById(
    "VSKit-rename-progress",
  ) as HTMLDivElement | null;
  if (!box) return;
  box.textContent = "";
  line(
    box,
    `Running ${payload.index + 1}/${payload.total}: ${payload.statement}`,
  );
}

interface DonePayload {
  applied: Array<{ index: number; label: string; sql: string }>;
  total: number;
  failed?: { index: number; label: string; sql: string; error: string };
  cancelledAfter?: number;
  remaining?: number;
}

function renderDone(payload: DonePayload): void {
  const box = document.getElementById(
    "VSKit-rename-progress",
  ) as HTMLDivElement | null;
  if (!box) return;
  box.textContent = "";
  if (payload.failed) {
    const f = payload.failed;
    line(
      box,
      `FAILED after ${payload.applied.length} applied — step ${f.label} (index ${f.index})${f.sql ? `: ${f.sql}` : ""}: ${f.error}`,
    );
    return;
  }
  if (payload.cancelledAfter !== undefined) {
    line(
      box,
      `Cancelled — ${payload.applied.length} applied, ${payload.remaining ?? 0} remaining.`,
    );
    return;
  }
  line(box, `Done — ${payload.applied.length} step(s) applied.`);
}

// ---- host messages -----------------------------------------------------------

function isAnalysis(
  m: Record<string, unknown>,
): boolean {
  return m.type === "analysis";
}

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as Record<string, unknown>;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "init") {
    state = {
      mode: msg.mode === "column" ? "column" : "table",
      schema: typeof msg.schema === "string" ? msg.schema : "",
      table: typeof msg.table === "string" ? msg.table : "",
      oldName: typeof msg.oldName === "string" ? msg.oldName : "",
      approved: false,
    };
    renderInit();
    return;
  }
  if (isAnalysis(msg)) {
    renderAnalysis(msg as unknown as AnalysisPayload);
    return;
  }
  if (msg.type === "progress") {
    renderProgress(msg as unknown as ProgressPayload);
    return;
  }
  if (msg.type === "done") {
    renderDone(msg as unknown as DonePayload);
    return;
  }
});

post({ type: "ready" });
