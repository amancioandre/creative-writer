import { describe, it, expect, afterEach, vi } from "vitest";
import { withFile, editorInfoField } from "obsidian";
import { activeNoteExtension, isActive, effectiveSettings } from "../../../src/infrastructure/codemirror/activeNote";
import { focusFadeExtension } from "../../../src/infrastructure/codemirror/focusFadeExtension";
import { mount, type Harness } from "./helpers";

const settle = () => new Promise((r) => setTimeout(r, 5));
const pathOf = (state: Parameters<typeof isActive>[0]) => state.field(editorInfoField, false)?.file?.path ?? null;

describe("activeNoteExtension", () => {
  let h: Harness;
  afterEach(() => { h?.destroy(); vi.useRealTimers(); });

  it("is active by default and every feature stays on", async () => {
    h = mount("l0\nl1\nl2", [withFile("a.md"), activeNoteExtension(pathOf), focusFadeExtension()]);
    await settle();
    expect(isActive(h.view.state)).toBe(true);
    expect(h.view.dom.classList.contains("czm-focus-fade")).toBe(true);
  });

  it("front matter creative-writer: false switches the note off, and editing it back switches it on", async () => {
    h = mount("---\ncreative-writer: false\n---\nl1\nl2", [withFile("a.md"), activeNoteExtension(pathOf), focusFadeExtension()]);
    await settle();
    expect(isActive(h.view.state)).toBe(false);
    expect(effectiveSettings(h.view.state).focusFadeEnabled).toBe(false);
    expect(h.view.dom.classList.contains("czm-focus-fade")).toBe(false);
    expect(h.lineEls().some((l) => [...l.classList].some((c) => c.startsWith("czm-focus-")))).toBe(false);

    h.view.dispatch({ changes: { from: 21, to: 26, insert: "true" } }); // false → true
    await settle();
    expect(isActive(h.view.state)).toBe(true);
    expect(h.view.dom.classList.contains("czm-focus-fade")).toBe(true);
  });

  it("scope mode 'folders' uses the file path; settings changes re-evaluate", async () => {
    h = mount("text", [withFile("notes/x.md"), activeNoteExtension(pathOf), focusFadeExtension()], { scope: { mode: "folders", folders: ["storytelling"] } });
    await settle();
    expect(isActive(h.view.state)).toBe(false);
    h.setSettings({ scope: { mode: "folders", folders: ["notes"] } });
    await settle();
    expect(isActive(h.view.state)).toBe(true);
    h.setSettings({ enabled: false });
    await settle();
    expect(isActive(h.view.state)).toBe(false);
  });

  it("effectiveSettings returns the same disabled object for the same settings", () => {
    h = mount("---\ncreative-writer: false\n---\n", [withFile("a.md"), activeNoteExtension(pathOf)]);
    return settle().then(() => {
      expect(effectiveSettings(h.view.state)).toBe(effectiveSettings(h.view.state));
      expect(effectiveSettings(h.view.state).llm.provider).toBe("off");
    });
  });
});
