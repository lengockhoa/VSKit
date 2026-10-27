import { describe, expect, it, vi } from "vitest";
import { buildCommitGenOmpPrintArgs, COMMIT_GEN_OMP_MAX_TIME, createCommitGenOmpPrintPort, type ChildProcessLike } from "../commitGenOmpPrint";

function fakeChild() {
  const listeners: Record<string, ((...args: never[]) => void)[]> = {};
  const stdin = {
    write: vi.fn((_text: string, callback?: (error?: Error | null) => void) => { callback?.(); return true; }),
    end: vi.fn(),
    on: vi.fn((event: string, cb: (...args: never[]) => void) => { (listeners[`stdin:${event}`] ??= []).push(cb); return stdin; }),
  };
  const stdout = { on: vi.fn((event: string, cb: (...args: never[]) => void) => { (listeners[`stdout:${event}`] ??= []).push(cb); return stdout; }) };
  const stderr = { on: vi.fn((event: string, cb: (...args: never[]) => void) => { (listeners[`stderr:${event}`] ??= []).push(cb); return stderr; }) };
  const child: ChildProcessLike = {
    stdin, stdout, stderr,
    kill: vi.fn(() => true),
    on: vi.fn((event: string, cb: (...args: never[]) => void) => { (listeners[`child:${event}`] ??= []).push(cb); return child; }),
    exitCode: null,
    killed: false,
  };
  return {
    child,
    emit(stream: string, event: string, ...args: unknown[]) {
      for (const listener of listeners[`${stream}:${event}`] ?? []) listener(...args as never[]);
    },
  };
}

const args = buildCommitGenOmpPrintArgs("lite-model");

describe("commit-generation omp print adapter", () => {
  it("builds print-mode args and keeps the timeout constant", () => {
    expect(args).toContain("-p");
    expect(args).toContain("--no-session");
    expect(args).toContain("--max-time");
    expect(args[args.indexOf("--max-time") + 1]).toBe(COMMIT_GEN_OMP_MAX_TIME);
    expect(args.slice(-2)).toEqual(["--model", "lite-model"]);
  });

  it("writes one prompt, returns bounded stdout on exit, reports first text, and kills child", async () => {
    const fake = fakeChild();
    const spawn = vi.fn(() => fake.child);
    const port = createCommitGenOmpPrintPort({ command: "omp", args, cwd: "/repo", timeoutMs: 1000, spawn });
    const firstText = vi.fn();
    const result = port.complete("prompt", firstText);
    expect(spawn).toHaveBeenCalledWith("omp", args, { cwd: "/repo", stdio: ["pipe", "pipe", "ignore"] });
    expect(fake.child.stdin.write).toHaveBeenCalledWith("prompt", expect.any(Function));
    expect(fake.child.stdin.end).toHaveBeenCalledOnce();
    fake.emit("stdout", "data", "response");
    fake.emit("child", "exit", 0, null);
    await expect(result).resolves.toBe("response");
    expect(firstText).toHaveBeenCalledOnce();
    expect(fake.child.kill).toHaveBeenCalledOnce();
  });

  it("caps stdout at 4096 characters", async () => {
    const fake = fakeChild();
    const port = createCommitGenOmpPrintPort({ command: "omp", args, cwd: "/repo", timeoutMs: 1000, spawn: () => fake.child });
    const result = port.complete("prompt");
    fake.emit("stdout", "data", "x".repeat(5000));
    fake.emit("child", "exit", 0, null);
    await expect(result).resolves.toHaveLength(4096);
  });

  it("never exposes stderr content on process failure", async () => {
    const fake = fakeChild();
    const port = createCommitGenOmpPrintPort({ command: "omp", args, cwd: "/repo", timeoutMs: 1000, spawn: () => fake.child });
    const result = port.complete("prompt");
    fake.emit("stderr", "data", "PRIVATE STDERR SECRET");
    fake.emit("child", "exit", 2, null);
    await expect(result).rejects.toThrow("exited with code 2");
    await expect(result).rejects.not.toThrow("PRIVATE STDERR SECRET");
  });

  it("aborts promptly and is single-use", async () => {
    const fake = fakeChild();
    const controller = new AbortController();
    const port = createCommitGenOmpPrintPort({ command: "omp", args, cwd: "/repo", timeoutMs: 1000, signal: controller.signal, spawn: () => fake.child });
    const result = port.complete("prompt");
    controller.abort();
    await expect(result).rejects.toThrow("cancelled");
    expect(fake.child.kill).toHaveBeenCalledOnce();
    await expect(port.complete("again")).rejects.toThrow("already used");
  });

  it("settles bounded when the child never responds — the old ACP-hang analog", async () => {
    // Pre-fix (ACP one-shot), a turn left unanswered never settled and only
    // the 120s ceiling fired ("omp did not finish within 120000ms"). The
    // print port must reject via its own bounded timer and kill the child.
    const fake = fakeChild();
    const port = createCommitGenOmpPrintPort({ command: "omp", args, cwd: "/repo", timeoutMs: 30, spawn: () => fake.child });
    const startedAt = Date.now();
    await expect(port.complete("prompt")).rejects.toThrow("omp print timed out after 30ms");
    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(fake.child.kill).toHaveBeenCalledOnce();
  });

  it("rejects when the child errors without exposing internals", async () => {
    const fake = fakeChild();
    const port = createCommitGenOmpPrintPort({ command: "omp", args, cwd: "/repo", timeoutMs: 1000, spawn: () => fake.child });
    const result = port.complete("prompt");
    fake.emit("child", "error", new Error("boom"));
    await expect(result).rejects.toThrow("spawn failed");
  });
});
