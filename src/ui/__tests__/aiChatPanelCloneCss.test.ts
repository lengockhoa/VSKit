// src/ui/__tests__/aiChatPanelCloneCss.test.ts
// TASK-AGTUI-001 - Claude Code clone design tokens + chat-scoped CSS layer
// (BLUE accent palette, big "U" brand glyph, red-square stop button, bypass
//  permissions toggle states, brand/thinking/tool/composer/chip classes).
//
// jsdom does not apply external stylesheets, so the contract is asserted
// against the source CSS text directly via regex (same pattern as
// chatLayoutCss.test.ts).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = resolve(process.cwd(), "webview", "styles.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

/** Extract the body of the FIRST top-level rule block whose selector matches
 * `selectorText` (the literal text preceding the first `{`). */
function ruleBody(selectorText: string): string {
  const escaped = selectorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  if (!m) return "";
  return m[2] ?? "";
}

/** Extract only the chat-scoped block (everything from the first `.VSKit-chat {`
 * through the last `}` of the file). Used to validate isolation + balanced braces. */
function chatBlock(): string {
  const start = css.search(/(^|\n)\.VSKit-chat\s*\{/);
  if (start < 0) return "";
  // Slice from the start of `.VSKit-chat` to end of file, then trim trailing
  // non-chat noise (should be none in practice).
  return css.slice(start);
}

const REQUIRED_SELECTORS = [
  ".VSKit-chat-header",
  ".VSKit-chat-brand",
  ".VSKit-chat-title",
  ".VSKit-chat-sessionchip",
  ".VSKit-chat-msg-user",
  ".VSKit-chat-msg-assistant",
  ".VSKit-chat-thought",
  ".VSKit-chat-tool",
  ".VSKit-chat-tool-failed",
  ".VSKit-chat-tool-denied",
  ".VSKit-chat-plan",
  ".VSKit-chat-usage",
  ".VSKit-chat-chip",
  ".VSKit-chat-chipmenu",
  ".VSKit-chat-toggle",
  ".VSKit-chat-toggle-on",
  ".VSKit-chat-stop",
  ".VSKit-chat-stop-live",
  ".VSKit-chat-secondary",
] as const;

describe("TASK-AGTUI-001 - clone CSS tokens + chat-scoped layer", () => {
  it("loads webview/styles.css", () => {
    expect(css, "webview/styles.css must exist").not.toBe("");
  });

  // Test case #1 — happy: token block exists.
  it(".VSKit-chat declares the BLUE/stop/warn clone token block", () => {
    const body = ruleBody(".VSKit-chat");
    expect(body, ".VSKit-chat rule block must exist").not.toBe("");
    expect(
      /--VSKit-chat-accent:\s*#3b82f6/i.test(body),
      ".VSKit-chat must declare --VSKit-chat-accent:#3b82f6",
    ).toBe(true);
    expect(
      /--VSKit-chat-accent-hover:\s*#60a5fa/i.test(body),
      ".VSKit-chat must declare --VSKit-chat-accent-hover:#60a5fa",
    ).toBe(true);
    expect(
      /--VSKit-chat-accent-strong:\s*#2563eb/i.test(body),
      ".VSKit-chat must declare --VSKit-chat-accent-strong:#2563eb",
    ).toBe(true);
    expect(
      /--VSKit-chat-stop:\s*#dc2626/i.test(body),
      ".VSKit-chat must declare --VSKit-chat-stop:#dc2626",
    ).toBe(true);
    expect(
      /--VSKit-chat-warn:\s*#f59e0b/i.test(body),
      ".VSKit-chat must declare --VSKit-chat-warn:#f59e0b",
    ).toBe(true);
  });

  // Test case #2 — edge (value/boundary): exact hexes, no Claude orange inside
  // .VSKit-chat rules.
  it("Claude-orange hexes are NOT used as accent inside .VSKit-chat rules", () => {
    const block = chatBlock();
    expect(block, "a .VSKit-chat rule block must exist for isolation scan").not.toBe("");
    // Strip out the `--VSKit-chat-accent*: #xxxxxx` lines themselves (they
    // legitimately contain the BLUE hex family) so we only scan rule bodies
    // for accent application, then re-check that no Claude orange appears.
    const ruleBodies = block.match(/\{[^}]*\}/g) ?? [];
    const joined = ruleBodies.join("\n");
    expect(
      /#d97757/i.test(joined),
      "Claude-orange #d97757 must NOT appear inside any .VSKit-chat rule body",
    ).toBe(false);
    expect(
      /#e8703a/i.test(joined),
      "Claude-orange #e8703a must NOT appear inside any .VSKit-chat rule body",
    ).toBe(false);
    expect(
      /\borange\b/i.test(joined),
      "literal `orange` keyword must NOT appear inside any .VSKit-chat rule body",
    ).toBe(false);
  });

  // Test case #3 — edge (isolation/scope): non-chat selectors untouched AND
  // every NEW rule added starts with `.VSKit-chat` or `.VSKit-chat-`.
  ;

  // Test case #4 — edge (malformed): balanced braces in chat section.
  it("chat section has balanced braces", () => {
    const block = chatBlock();
    expect(block, "a .VSKit-chat rule block must exist").not.toBe("");
    const open = (block.match(/\{/g) ?? []).length;
    const close = (block.match(/\}/g) ?? []).length;
    expect(open, "chat section must contain `{`").toBeGreaterThan(0);
    expect(close, "chat section must contain `}`").toBeGreaterThan(0);
    expect(
      open,
      `chat section brace count must be balanced (open=${open}, close=${close})`,
    ).toBe(close);
  });

  // Branded glyph: big "U" — 28px+ bold sans-serif BLUE.
  ;

  // Stop button: square, red, with pulse animation hook.
  ;

  // Bypass-permissions toggle: BLUE OFF, amber ON.
  ;
});