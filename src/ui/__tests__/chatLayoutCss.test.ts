// src/ui/__tests__/chatLayoutCss.test.ts
// TASK-003 - Chat layout CSS contract (pinned composer + full-height thread,
// plus TASK-002 affordances + TASK-005 mention-dropdown selectors + fix-round-1
// height-chain + 6 missing TASK-002 affordance styles + cycle-AB image-attach
// strip + button + warning + dark theme tokens).
//
// jsdom does not apply external stylesheets, so the contract is asserted
// against the source CSS text directly via regex (same pattern as
// webviewToolbar.test.ts and resultsGridModelNull.test.ts).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = resolve(process.cwd(), "webview", "styles.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

/** Extract the body of the FIRST top-level rule block matching `selector`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  if (!m) return "";
  return m[2] ?? "";
}

/** True if any `selector:hover` (or `selector.x:hover`) rule exists in the file.
 * FIX ROUND 1 — minor: \s inside the template string previously degraded to `s`;
 * it worked by accident because the literal `s*` matches zero `s` chars. Escape
 * it now so the regex compiles as whitespace. */
function hasHoverRule(selector: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}(?:\\.[\\w-]+)*\\s*:hover\\s*\\{`);
  return re.test(css);
}

describe("TASK-003 - chat layout CSS contract", () => {
  it("loads webview/styles.css", () => {
    expect(css, "webview/styles.css must exist").not.toBe("");
  });

  it(".VSKit-chat-thread grows via flex:1 and no longer caps at 60vh", () => {
    const body = ruleBody(".VSKit-chat-thread");
    expect(body, ".VSKit-chat-thread rule block must exist").not.toBe("");
    expect(
      /flex:\s*1(?:[^;]*;|$)/.test(body),
      ".VSKit-chat-thread must declare flex:1 (or flex:1 1 auto)",
    ).toBe(true);
    // FIX ROUND 1 — minor: the original `/max-height: \s*60vh/` had a literal
    // space after the colon, so `max-height:60vh` (no space) slipped through.
    // Already space-tolerant, but document the invariant with a space-free
    // form check too.
    expect(
      /max-height:\s*60vh/i.test(body),
      ".VSKit-chat-thread must NOT contain max-height:60vh (kills the bug)",
    ).toBe(false);
    expect(
      /max-height:60vh/i.test(body),
      ".VSKit-chat-thread must NOT contain space-free max-height:60vh either",
    ).toBe(false);
    expect(
      /overflow-y:\s*auto/i.test(body),
      ".VSKit-chat-thread must keep overflow-y:auto so the thread scrolls",
    ).toBe(true);
  });

  it(".VSKit-chat shell is a full-height flex column so the composer pins bottom", () => {
    const body = ruleBody(".VSKit-chat");
    expect(body, ".VSKit-chat rule block must exist").not.toBe("");
    expect(
      /display:\s*flex/i.test(body),
      ".VSKit-chat must declare display:flex",
    ).toBe(true);
    expect(
      /flex-direction:\s*column/i.test(body),
      ".VSKit-chat must declare flex-direction:column",
    ).toBe(true);
    expect(
      /height:\s*100%/i.test(body),
      ".VSKit-chat must declare height:100%",
    ).toBe(true);
  });

  ;

  // FIX ROUND 1 — critical: height-chain.
  // `<body class="VSKit-form-body">` (src/ui/aiChatPanel.ts buildHtml) had no
  // height rule, so `.VSKit-chat { height:100% }` collapsed against auto → ~205px
  // root. Add a chat-scoped body class + height rule; do not break OTHER forms
  // (connectionForm etc. still share `VSKit-form-body`).
  it("chat webview body establishes a real height chain (body.VSKit-chat-body height:100vh)", () => {
    const body = ruleBody("body.VSKit-chat-body");
    expect(
      body,
      "body.VSKit-chat-body rule block must exist — fixes the 205px panel collapse (CRITICAL)",
    ).not.toBe("");
    expect(
      /height:\s*100vh/i.test(body),
      "body.VSKit-chat-body must declare height:100vh (fills the webview viewport)",
    ).toBe(true);
    expect(
      /overflow:\s*hidden/i.test(body),
      "body.VSKit-chat-body must declare overflow:hidden so the panel owns scrolling",
    ).toBe(true);
  });

  it(".VSKit-chat fills its body (height:100% + min-height:0) — chain to 100vh", () => {
    const body = ruleBody(".VSKit-chat");
    expect(body, ".VSKit-chat rule block must exist").not.toBe("");
    expect(
      /height:\s*100%/i.test(body),
      ".VSKit-chat must declare height:100% so it fills body.VSKit-chat-body",
    ).toBe(true);
    expect(
      /min-height:\s*0/i.test(body),
      ".VSKit-chat must declare min-height:0 (flex children need explicit min-height to shrink)",
    ).toBe(true);
  });

  it("VSKit-form-body (other forms) is NOT touched by the height chain — scope preserved", () => {
    const formBody = ruleBody(".VSKit-form-body");
    expect(formBody, ".VSKit-form-body rule block must still exist").not.toBe("");
    expect(
      /height:\s*100vh/i.test(formBody),
      ".VSKit-form-body (shared with connectionForm etc.) must NOT declare height:100vh",
    ).toBe(false);
  });

  // FIX ROUND 1 — important: 6 missing TASK-002 affordance styles.
  describe("TASK-002 affordances (CSS contract)", () => {
    it("thinking block: VSKit-chat-thinking uses a card-like surface", () => {
      const body = ruleBody(".VSKit-chat-thinking");
      expect(body, ".VSKit-chat-thinking rule block must exist").not.toBe("");
      expect(
        /border:\s*1px\s+solid/i.test(body),
        ".VSKit-chat-thinking must declare a 1px solid border",
      ).toBe(true);
      expect(
        /background:\s*var\(/i.test(body),
        ".VSKit-chat-thinking must use a --vscode- themed background",
      ).toBe(true);
      const bodyInner = ruleBody(".VSKit-chat-thinking-body");
      expect(
        bodyInner,
        ".VSKit-chat-thinking-body rule block must exist",
      ).not.toBe("");
      expect(
        /padding:\s*\d/i.test(bodyInner),
        ".VSKit-chat-thinking-body must declare a padding value",
      ).toBe(true);
    });

    it("jump-to-latest: floating button pinned bottom-right of the thread", () => {
      const body = ruleBody(".VSKit-chat-jump");
      expect(body, ".VSKit-chat-jump rule block must exist").not.toBe("");
      expect(
        /position:\s*(?:fixed|absolute)/i.test(body),
        ".VSKit-chat-jump must be position:fixed or position:absolute (floating)",
      ).toBe(true);
      expect(
        /bottom:\s*\d/i.test(body),
        ".VSKit-chat-jump must anchor bottom",
      ).toBe(true);
      expect(
        /right:\s*\d/i.test(body),
        ".VSKit-chat-jump must anchor right",
      ).toBe(true);
      expect(
        /z-index:\s*\d+/i.test(body),
        ".VSKit-chat-jump must declare a z-index (floats above the thread)",
      ).toBe(true);
    });

    it("md-copy: small inline button attached to a code block", () => {
      const body = ruleBody(".VSKit-md-copy");
      expect(body, ".VSKit-md-copy rule block must exist").not.toBe("");
      expect(
        /font-size:\s*\d/i.test(body),
        ".VSKit-md-copy must declare a font-size (compact button)",
      ).toBe(true);
      expect(
        /cursor:\s*pointer/i.test(body),
        ".VSKit-md-copy must declare cursor:pointer",
      ).toBe(true);
    });

    it("queued marker: small visual indicator distinct from a settled bubble", () => {
      const body = ruleBody(".VSKit-chat-queued");
      expect(body, ".VSKit-chat-queued rule block must exist").not.toBe("");
      // Accept either animation, opacity-based blink, or explicit inline-block
      // sizing — anything that makes the otherwise zero-width span visible.
      expect(
        /(animation:\s*\w+|opacity:\s*0?\.\d|display:\s*inline-block)/i.test(
          body,
        ),
        ".VSKit-chat-queued must declare animation/opacity/display (visual marker)",
      ).toBe(true);
    });

    it("streaming caret: visible glyph on a streaming assistant bubble", () => {
      // The caret can live on the streaming bubble via ::after OR on the
      // .VSKit-chat-caret span itself (TASK-002 used the latter: ensureStreamingCaret
      // appends <span class="VSKit-chat-caret">). Accept either form.
      const directBody = ruleBody(".VSKit-chat-caret");
      const streamingAfter =
        /\.VSKit-chat-assistant\.VSKit-chat-streaming::after\s*\{[^}]*content:\s*['"]/i.test(
          css,
        );
      const hasDirect =
        directBody !== "" &&
        /(display:\s*inline(?:-block)?|animation:\s*\w+|opacity:\s*0?\.\d|font-family)/i.test(
          directBody,
        );
      expect(
        hasDirect || streamingAfter,
        "streaming caret must be visible: either .VSKit-chat-caret with display/animation OR .VSKit-chat-assistant.VSKit-chat-streaming::after with a non-empty content",
      ).toBe(true);
    });

    it("regenerateBtn: button-level affordance styled or inherits .VSKit-chat-secondary", () => {
      // TASK-AG-001: regenerateBtn is an icon-only tile styled by the shared
      // `.VSKit-chat-actions button` rule (28×28 square, cursor:pointer) — the
      // old per-ID override and the .VSKit-chat-secondary text-button styling
      // are gone. Accept either the shared tile rule, a per-ID override, or
      // the legacy .VSKit-chat-secondary class as the affordance contract.
      const rule = ruleBody("#regenerateBtn");
      const tile = ruleBody(".VSKit-chat-actions button");
      const secondaryBody = ruleBody(".VSKit-chat-secondary");
      const hasInline = /(padding|margin|font-size|color|background|border|cursor):\s*[^\s;]/i.test(
        rule,
      );
      const hasTile = /(width|height|cursor):\s*[^\s;]/i.test(tile);
      const hasSecondaryClass = /\.VSKit-chat-secondary/.test(css);
      expect(
        hasInline || hasTile || hasSecondaryClass,
        "#regenerateBtn must be styled by the shared .VSKit-chat-actions button tile, styled inline, OR inherit from .VSKit-chat-secondary",
      ).toBe(true);
      if (!hasInline && !hasTile) {
        // Legacy fallback path: regenerateBtn shares .VSKit-chat-secondary —
        // make sure that class has at least minimal button styling.
        expect(secondaryBody, ".VSKit-chat-secondary rule block must exist").not.toBe("");
        expect(
          /(font-size|padding|cursor):\s*[^\s;]/i.test(secondaryBody),
          ".VSKit-chat-secondary must declare at least one visual property",
        ).toBe(true);
      }
    });
  });

  ;

  ;

  it("getHtml emits VSKit-chat-body on <body> so the height chain actually applies (fix round 1 re-review)", () => {
    // The CSS rule alone is dead if buildHtml never puts the class on the
    // body element. Same text-contract approach as the CSS checks above:
    // parse the panel source and assert the emitted body tag carries both
    // classes (the wire side of the height chain, reviewer R4.5 finding).
    const panelSrc = readFileSync(
      resolve(process.cwd(), "src", "ui", "aiChatPanel.ts"),
      "utf8",
    );
    expect(panelSrc).toContain('<body class="VSKit-form-body VSKit-chat-body">');
  });

  // -----------------------------------------------------------------------
  // Cycle AB — TASK-003 image-attach CSS contract.
  // The webview needs:
  //   - .VSKit-chat-attach-btn     (icon button next to send)
  //   - .VSKit-chat-attachments    (thumbnail strip ABOVE the textarea)
  //   - .VSKit-chat-thumb          (56×56 frame, hosts an <img>)
  //   - .VSKit-chat-thumb-remove   (absolute overlay on the thumbnail)
  //   - .VSKit-chat-attach-warning (amber notice bubble)
  // Plus theme tokens declared at :root (light defaults) and overridden in a
  // [data-theme="dark"] block:
  //   --VSKit-warning-bg / --VSKit-warning-fg / --VSKit-warning-border
  //   --VSKit-overlay-bg
  //   --VSKit-input-hover-bg
  //   --VSKit-error-bg
  // The thumb strip lives inside .VSKit-chat-input so the cycle-AA pinned
  // composer + height chain still owns scrolling; the css contract test below
  // guards that lock too (case h).
  // -----------------------------------------------------------------------
  describe("TASK-003 cycle AB — image attach CSS contract", () => {
    ;

    ;

    ;

    ;

    ;

    ;

    it("f) .VSKit-chat-attach-warning references var(--VSKit-warning-bg) (theme-token contract)", () => {
      const body = ruleBody(".VSKit-chat-attach-warning");
      expect(
        body,
        ".VSKit-chat-attach-warning rule block must exist",
      ).not.toBe("");
      expect(
        /var\(\s*--VSKit-warning-bg\s*\)/i.test(body),
        ".VSKit-chat-attach-warning must reference var(--VSKit-warning-bg)",
      ).toBe(true);
    });

    it("g) [data-theme=\"dark\"] block declares at least one of the new tokens (dark variant present)", () => {
      // The dark block may be one or many rules; scan every body in the file
      // that opens with [data-theme="dark"] { … } and require at least one
      // cycle-AB token inside. At minimum this proves the token system is
      // wired; surface-specific dark overrides may be added later.
      const re = /\[data-theme=["']dark["']\]\s*\{([^}]*)\}/gi;
      const bodies: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(css)) !== null) bodies.push(m[1]);
      const tokens = [
        "--VSKit-warning-bg",
        "--VSKit-warning-fg",
        "--VSKit-warning-border",
        "--VSKit-overlay-bg",
        "--VSKit-input-hover-bg",
        "--VSKit-error-bg",
      ];
      const found = bodies.some((b) =>
        tokens.some((tok) => new RegExp(tok + "\\s*:", "i").test(b)),
      );
      expect(
        found,
        `[data-theme="dark"] block must declare at least one of: ${tokens.join(", ")}`,
      ).toBe(true);
    });

    it("h) regression: body.VSKit-chat-body { height: 100vh } rule still present (cycle AA height chain)", () => {
      const body = ruleBody("body.VSKit-chat-body");
      expect(
        body,
        "body.VSKit-chat-body rule block must still exist (cycle AA lock)",
      ).not.toBe("");
      expect(
        /height:\s*100vh/i.test(body),
        "body.VSKit-chat-body must still declare height:100vh",
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // TASK-UX1-008 — R9 streaming one-char-per-line + R10 left padding tight.
  // Cases pinned in docs/AI_HANDOFF/tasks/TASK-UX1-008.md §Test Cases (1-6).
  // jsdom does not apply stylesheets, so the contract is asserted against
  // the source CSS text directly (same pattern as the rest of this file).
  // -----------------------------------------------------------------------
  describe("TASK-UX1-008 - streaming bubble layout (R9 + R10)", () => {
    it("R9 case 1: .VSKit-chat-bubble declares min-height + width:fit-content and retains max-width<=95%", () => {
      const bubble = ruleBody(".VSKit-chat-bubble");
      expect(bubble, ".VSKit-chat-bubble rule block must exist").not.toBe("");
      // Positive min-height so an empty/short bubble still occupies one line
      // (prevents vertical one-char-per-line collapse during pre-first-delta).
      expect(
        /min-height:\s*\d/i.test(bubble),
        ".VSKit-chat-bubble must declare a positive min-height (e.g. 1lh / 16px)",
      ).toBe(true);
      // fit-content so the bubble shrinks to its content width and never
      // gets reflowed into a one-char-wide column by flex sizing.
      expect(
        /width:\s*fit-content/i.test(bubble),
        ".VSKit-chat-bubble must declare width:fit-content",
      ).toBe(true);
      // Cap retained so long SQL still wraps inside the panel.
      expect(
        /max-width:\s*95%/i.test(bubble),
        ".VSKit-chat-bubble must RETAIN max-width:95% (regression guard)",
      ).toBe(true);
    });

    it("R9 case 2: .VSKit-chat-caret no longer uses display:inline-block (was the one-char-per-line cause)", () => {
      const caret = ruleBody(".VSKit-chat-caret");
      expect(caret, ".VSKit-chat-caret rule block must exist").not.toBe("");
      expect(
        /display:\s*inline-block/i.test(caret),
        ".VSKit-chat-caret must NOT declare display:inline-block (forces own line box, garbles streaming text)",
      ).toBe(false);
      // The fix replaces it with display:inline (or equivalent). Accept any
      // non-block value so the test stays pinned to the bug, not the syntax.
      expect(
        /display:\s*(?:inline(?:-flex)?|contents?)/i.test(caret),
        ".VSKit-chat-caret must declare a non-block display value (inline/inline-flex/contents)",
      ).toBe(true);
    });

    it("R9 case 3: .VSKit-chat-assistant.VSKit-chat-streaming RETAINs white-space:pre-wrap (regression guard)", () => {
      // The naive "fix" for R9 would be white-space:normal — that would
      // collapse streamed multi-line SQL onto one line. Pinned regression.
      const streaming = ruleBody(".VSKit-chat-assistant.VSKit-chat-streaming");
      expect(
        streaming,
        ".VSKit-chat-assistant.VSKit-chat-streaming rule block must exist",
      ).not.toBe("");
      expect(
        /white-space:\s*pre-wrap/i.test(streaming),
        ".VSKit-chat-assistant.VSKit-chat-streaming must RETAIN white-space:pre-wrap",
      ).toBe(true);
      // Same guard at the base bubble level.
      const bubble = ruleBody(".VSKit-chat-bubble");
      expect(
        /white-space:\s*pre-wrap/i.test(bubble),
        ".VSKit-chat-bubble must RETAIN white-space:pre-wrap",
      ).toBe(true);
    });

    it("R10 case 4: assistant bubbles are NOT flush against the left border (padding-left>=12px or thread margin-left>=8px)", () => {
      const assistant = ruleBody(".VSKit-chat-assistant");
      const thread = ruleBody(".VSKit-chat-thread");
      expect(assistant, ".VSKit-chat-assistant rule block must exist").not.toBe("");
      expect(thread, ".VSKit-chat-thread rule block must exist").not.toBe("");
      const assistantPadding =
        /padding-left:\s*(?:1[2-9]|[2-9]\d|\d{3,})px/i.test(assistant);
      const threadMargin =
        /margin-left:\s*(?:[8-9]|[1-9]\d+)px/i.test(thread);
      expect(
        assistantPadding || threadMargin,
        "either .VSKit-chat-assistant padding-left>=12px OR .VSKit-chat-thread margin-left>=8px must hold (R10)",
      ).toBe(true);
    });

    it("R10 case 5: .VSKit-chat-user retains align-self:flex-end (user bubble unaffected by R10)", () => {
      const user = ruleBody(".VSKit-chat-user");
      expect(user, ".VSKit-chat-user rule block must exist").not.toBe("");
      expect(
        /align-self:\s*flex-end/i.test(user),
        ".VSKit-chat-user must RETAIN align-self:flex-end (right-aligned user bubble)",
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // TASK-UX1-009 — R11 chat improvements: case 8 (right-edge truncation).
  // The fix is anchored on the EXISTING `.VSKit-chat-bubble` selector —
  // the task scope is APPEND-ONLY on UX1-008's existing rule block. The
  // bubble already has `white-space: pre-wrap` and `max-width:95%` from
  // UX1-008; R11 just adds `overflow-wrap: anywhere` so long SQL/code
  // lines break at the panel edge instead of overflowing horizontally.
  // -----------------------------------------------------------------------
  describe("TASK-UX1-009 - right-edge text truncation (R11)", () => {
    it("case 8: .VSKit-chat-bubble declares overflow-wrap:anywhere (R11 truncation contract)", () => {
      const body = ruleBody(".VSKit-chat-bubble");
      expect(body, ".VSKit-chat-bubble rule block must exist").not.toBe("");
      expect(
        /overflow-wrap:\s*anywhere/i.test(body),
        ".VSKit-chat-bubble must declare overflow-wrap:anywhere (R11 truncation)",
      ).toBe(true);
    });
  });
});
