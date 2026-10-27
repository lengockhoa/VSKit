// src/ai/commitGenOmpPrint.ts
// Single-use, bounded omp print-mode process port for SCM commit generation.
// No vscode import; stderr content is intentionally never exposed.
import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export const COMMIT_GEN_OMP_MAX_TIME = "100";

export function buildCommitGenOmpPrintArgs(modelId: string): string[] {
  return [
    "-p", // Print one response to stdout.
    "--no-session", // Do not persist the ephemeral diff prompt.
    "--thinking", "low", // Keep one-line generation latency low.
    "--no-tools", // Do not enable tools for this request.
    "--no-extensions", // Do not load extensions for this request.
    "--no-skills", // Do not load skills for this request.
    "--no-rules", // Do not load rules for this request.
    "--max-time", COMMIT_GEN_OMP_MAX_TIME, // Self-terminate before host ceiling.
    "--model", modelId, // Use the configured Lite model verbatim.
  ];
}

export interface CommitGenOmpPrintPort {
  complete(prompt: string, onFirstText?: () => void): Promise<string>;
}

export interface ChildReadableLike {
  on(event: "data", listener: (chunk: string | Uint8Array) => void): this;
}

export interface ChildWritableLike {
  write(data: string, callback?: (error?: Error | null) => void): boolean;
  end(): void;
  on(event: "error", listener: (error: Error) => void): this;
}

export interface ChildProcessLike {
  stdin: ChildWritableLike;
  stdout: ChildReadableLike;
  stderr: ChildReadableLike;
  kill(): boolean;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
  readonly exitCode: number | null;
  readonly killed: boolean;
  readonly pid?: number;
}

export function createCommitGenOmpPrintPort(deps: {
  command: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  spawn?: (
    cmd: string,
    args: readonly string[],
    opts: { cwd: string; stdio: readonly ("pipe" | "ignore")[] },
  ) => ChildProcessLike;
}): CommitGenOmpPrintPort {
  let used = false;
  return {
    complete(prompt, onFirstText) {
      if (used) return Promise.reject(new Error("commit-gen: omp print port already used"));
      used = true;

      return new Promise<string>((resolve, reject) => {
        const spawnChild = deps.spawn ?? ((cmd, args, opts) =>
          nodeSpawn(cmd, [...args], { cwd: opts.cwd, stdio: [...opts.stdio] }) as ChildProcessWithoutNullStreams as unknown as ChildProcessLike);
        let child: ChildProcessLike;
        try {
          child = spawnChild(deps.command, [...deps.args], {
            cwd: deps.cwd,
            stdio: ["pipe", "pipe", "ignore"],
          });
        } catch (error) {
          reject(new Error(`commit-gen: omp print spawn failed: ${error instanceof Error ? error.message : String(error)}`));
          return;
        }

        let settled = false;
        let firstText = false;
        let stdout = "";
        const settle = (error?: Error, value?: string): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          deps.signal?.removeEventListener("abort", onAbort);
          child.kill();
          if (error) reject(error);
          else resolve(value ?? stdout);
        };
        const onAbort = (): void => settle(new Error("commit-gen: cancelled"));
        const timer = setTimeout(
          () => settle(new Error(`commit-gen: omp print timed out after ${deps.timeoutMs}ms`)),
          deps.timeoutMs,
        );
        if (deps.signal?.aborted) {
          onAbort();
          return;
        }
        deps.signal?.addEventListener("abort", onAbort, { once: true });

        child.stdout.on("data", (chunk) => {
          const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
          if (!firstText && text.length > 0) {
            firstText = true;
            onFirstText?.();
          }
          stdout = (stdout + text).slice(0, 4096);
        });
        child.stderr.on("data", () => { /* stderr is never retained or exposed */ });
        child.stdin.on("error", () => settle(new Error("commit-gen: omp print stdin write failed")));
        child.on("error", (error) => settle(new Error(`commit-gen: omp print spawn failed: ${error.message}`)));
        child.on("exit", (code) => {
          if (code === 0) settle(undefined, stdout);
          else settle(new Error(`commit-gen: omp print exited with code ${code ?? "unknown"}`));
        });
        try {
          child.stdin.write(prompt, (error) => {
            if (error) settle(new Error("commit-gen: omp print stdin write failed"));
          });
          if (!settled) child.stdin.end();
        } catch {
          settle(new Error("commit-gen: omp print stdin write failed"));
        }
      });
    },
  };
}
