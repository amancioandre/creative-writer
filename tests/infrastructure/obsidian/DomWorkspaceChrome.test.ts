import { describe, it, expect, afterEach, vi } from "vitest";
import { DomWorkspaceChrome, ZEN_BODY_CLASS } from "../../../src/infrastructure/obsidian/DomWorkspaceChrome";

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
