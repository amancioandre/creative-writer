import { describe, it, expect, afterEach, vi } from "vitest";
import { typewriterExtension, shouldRecenter } from "../../../src/infrastructure/codemirror/typewriterExtension";
import { mount, type Harness } from "./helpers";

describe("shouldRecenter (policy)", () => {
  const base = { docChanged: false, selectionSet: false, hasFocus: true, enabled: true };
  it("recenters on typing", () => expect(shouldRecenter({ ...base, docChanged: true })).toBe(true));
  it("recenters on cursor movement", () => expect(shouldRecenter({ ...base, selectionSet: true })).toBe(true));
  it("ignores updates that change neither doc nor selection (e.g. viewport scroll)", () =>
    expect(shouldRecenter(base)).toBe(false));
  it("ignores unfocused editors (another pane updated)", () =>
    expect(shouldRecenter({ ...base, docChanged: true, hasFocus: false })).toBe(false));
  it("does nothing when disabled", () =>
    expect(shouldRecenter({ ...base, docChanged: true, enabled: false })).toBe(false));
});

describe("typewriterExtension (wiring)", () => {
  let h: Harness;
  afterEach(() => { h?.destroy(); vi.restoreAllMocks(); });

  it("tags the editor root so CSS can add the vertical padding", () => {
    h = mount("a\nb", typewriterExtension());
    expect(h.view.dom.classList.contains("czm-typewriter")).toBe(true);
    h.setSettings({ typewriterEnabled: false });
    expect(h.view.dom.classList.contains("czm-typewriter")).toBe(false);
  });

  it("requests a centred scroll after the cursor moves", async () => {
    h = mount("a\nb\nc", typewriterExtension());
    const spy = vi.spyOn(h.view, "dispatch");
    h.moveCursor(4);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    const scrollCalls = spy.mock.calls.filter(([tr]) => {
      const spec = tr as { effects?: unknown };
      return spec.effects !== undefined;
    });
    expect(scrollCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not request a scroll when disabled", async () => {
    h = mount("a\nb\nc", typewriterExtension(), { typewriterEnabled: false });
    const spy = vi.spyOn(h.view, "dispatch");
    h.moveCursor(4);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    expect(spy.mock.calls.filter(([tr]) => (tr as { effects?: unknown }).effects !== undefined)).toHaveLength(0);
  });
});
