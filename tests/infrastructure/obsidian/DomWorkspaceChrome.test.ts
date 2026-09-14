import { describe, it, expect, afterEach, vi } from "vitest";
import { DomWorkspaceChrome, HUD_MS, ZEN_BODY_CLASS, ZEN_HUD_CLASS } from "../../../src/infrastructure/obsidian/DomWorkspaceChrome";

describe("DomWorkspaceChrome", () => {
  afterEach(() => { document.body.className = ""; vi.restoreAllMocks(); });

  it("toggles the zen class on <body>", () => {
    const chrome = new DomWorkspaceChrome(document);
    chrome.hideChrome();
    expect(document.body.classList.contains(ZEN_BODY_CLASS)).toBe(true);
    chrome.showChrome();
    expect(document.body.classList.contains(ZEN_BODY_CLASS)).toBe(false);
  });

  it("enters and exits fullscreen via the Fullscreen API when available", async () => {
    const req = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { value: req, configurable: true });
    Object.defineProperty(document, "exitFullscreen", { value: exit, configurable: true });
    Object.defineProperty(document, "fullscreenElement", { value: document.documentElement, configurable: true });
    const chrome = new DomWorkspaceChrome(document);
    await chrome.enterFullscreen();
    expect(req).toHaveBeenCalled();
    await chrome.exitFullscreen();
    expect(exit).toHaveBeenCalled();
  });

  it("is a no-op when the Fullscreen API is missing", async () => {
    Object.defineProperty(document.documentElement, "requestFullscreen", { value: undefined, configurable: true });
    Object.defineProperty(document, "exitFullscreen", { value: undefined, configurable: true });
    const chrome = new DomWorkspaceChrome(document);
    await expect(chrome.enterFullscreen()).resolves.toBeUndefined();
    await expect(chrome.exitFullscreen()).resolves.toBeUndefined();
  });

  it("does not call exitFullscreen when nothing is fullscreen", async () => {
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "exitFullscreen", { value: exit, configurable: true });
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    await new DomWorkspaceChrome(document).exitFullscreen();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("the Zen indicator", () => {
  const editor = () => { const ed = document.body.createDiv({ cls: "cm-editor" }); return ed.createDiv({ cls: "cm-content" }); };
  afterEach(() => { document.body.replaceChildren(); document.body.className = ""; vi.useRealTimers(); });

  it("appears on mouse move with today's words and the way out, then fades", () => {
    vi.useFakeTimers();
    const chrome = new DomWorkspaceChrome(document, { wordsToday: () => 1234, leave: () => {} });
    chrome.hideChrome();
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    const hud = document.querySelector(`.${ZEN_HUD_CLASS}`);
    expect(hud?.textContent).toBe("1,234 words today · Esc leaves Zen Mode");
    expect(hud?.classList.contains("is-shown")).toBe(true);
    vi.advanceTimersByTime(HUD_MS + 1);
    expect(hud?.classList.contains("is-shown")).toBe(false);
    chrome.showChrome();
    expect(document.querySelector(`.${ZEN_HUD_CLASS}`)).toBeNull();
  });

  it("never appears while typing", () => {
    vi.useFakeTimers();
    const chrome = new DomWorkspaceChrome(document, { wordsToday: () => 0, leave: () => {} });
    chrome.hideChrome();
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(document.querySelector(`.${ZEN_HUD_CLASS}`)?.classList.contains("is-shown")).toBe(true);
    editor().dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(document.querySelector(`.${ZEN_HUD_CLASS}`)?.classList.contains("is-shown")).toBe(false);
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(document.querySelector(`.${ZEN_HUD_CLASS}`)?.classList.contains("is-shown")).toBe(false);
    vi.advanceTimersByTime(500);
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(document.querySelector(`.${ZEN_HUD_CLASS}`)?.textContent).toBe("No words yet today · Esc leaves Zen Mode");
  });

  it("leaves on Escape from the page, not from a modal or from outside the editor", () => {
    const leave = vi.fn();
    const chrome = new DomWorkspaceChrome(document, { wordsToday: () => 0, leave });
    chrome.hideChrome();
    const content = editor();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(leave).not.toHaveBeenCalled();
    const modal = document.body.createDiv({ cls: "modal-container" });
    content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(leave).not.toHaveBeenCalled();
    modal.remove();
    content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(leave).toHaveBeenCalledTimes(1);
    chrome.showChrome();
    content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
