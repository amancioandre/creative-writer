import { describe, it, expect } from "vitest";
import { ToggleZenMode } from "../../src/application/use-cases/ToggleZenMode";
import type { WorkspaceChrome } from "../../src/application/ports/WorkspaceChrome";

class FakeChrome implements WorkspaceChrome {
  hidden = false;
  fullscreen = false;
  readonly log: string[] = [];
  hideChrome() { this.hidden = true; this.log.push("hide"); }
  showChrome() { this.hidden = false; this.log.push("show"); }
  async enterFullscreen() { this.fullscreen = true; this.log.push("fs-on"); }
  async exitFullscreen() { this.fullscreen = false; this.log.push("fs-off"); }
}

describe("ToggleZenMode", () => {
  it("hides chrome on first toggle and shows it on the second", async () => {
    const chrome = new FakeChrome();
    const useCase = new ToggleZenMode(chrome, () => false);
    await useCase.execute();
    expect(chrome.hidden).toBe(true);
    expect(useCase.isActive).toBe(true);
    await useCase.execute();
    expect(chrome.hidden).toBe(false);
    expect(useCase.isActive).toBe(false);
  });

  it("requests fullscreen only when the setting says so", async () => {
    const chrome = new FakeChrome();
    const useCase = new ToggleZenMode(chrome, () => true);
    await useCase.execute();
    expect(chrome.log).toEqual(["hide", "fs-on"]);
    await useCase.execute();
    expect(chrome.log).toEqual(["hide", "fs-on", "show", "fs-off"]);
  });

  it("does not touch fullscreen when disabled", async () => {
    const chrome = new FakeChrome();
    const useCase = new ToggleZenMode(chrome, () => false);
    await useCase.execute();
    await useCase.execute();
    expect(chrome.log).toEqual(["hide", "show"]);
  });

  it("deactivate() is idempotent and safe to call on unload", async () => {
    const chrome = new FakeChrome();
    const useCase = new ToggleZenMode(chrome, () => true);
    await useCase.deactivate();
    expect(chrome.log).toEqual([]);
    await useCase.execute();
    await useCase.deactivate();
    await useCase.deactivate();
    expect(chrome.log).toEqual(["hide", "fs-on", "show", "fs-off"]);
  });

  it("swallows fullscreen failures (browsers reject without a user gesture)", async () => {
    const chrome = new FakeChrome();
    chrome.enterFullscreen = async () => { throw new Error("not allowed"); };
    const useCase = new ToggleZenMode(chrome, () => true);
    await expect(useCase.execute()).resolves.toBeUndefined();
    expect(useCase.isActive).toBe(true);
    expect(chrome.hidden).toBe(true);
  });
});
