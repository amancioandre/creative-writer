import { describe, it, expect, vi } from "vitest";
import { App } from "obsidian";
import { ReleaseNoteModal } from "../../../src/infrastructure/obsidian/ReleaseNoteModal";
import { FORM_URL, GUIDE_URL, RELEASE_URL } from "../../../src/domain/release/notes";

const buttons = (m: ReleaseNoteModal) => Array.from(m.contentEl.querySelectorAll("button")).map((b) => b.textContent);
const click = (m: ReleaseNoteModal, text: string) => Array.from(m.contentEl.querySelectorAll("button")).find((b) => b.textContent === text)!.click();

describe("ReleaseNoteModal", () => {
  it("the update note names the minor version, lists three bullets and offers the form, the release page and Close", () => {
    const open = vi.fn();
    const m = new ReleaseNoteModal(new App(), "update", "0.11.2", open);
    m.open();
    expect(m.titleEl.textContent).toBe("Creative Writer 0.11");
    expect(m.contentEl.querySelectorAll("li").length).toBe(3);
    expect(buttons(m)).toEqual(["Close", "What changed", "Tell me how it goes"]);
    expect(m.contentEl.querySelector(".mod-cta")?.textContent).toBe("Tell me how it goes");
    click(m, "Tell me how it goes");
    expect(open).toHaveBeenCalledWith(FORM_URL);
    expect(m.opened).toBe(false);
  });
  it("the welcome note has no version and points at the guide", () => {
    const open = vi.fn();
    const m = new ReleaseNoteModal(new App(), "welcome", "0.11.0", open);
    m.open();
    expect(m.titleEl.textContent).toBe("Creative Writer");
    expect(buttons(m)).toEqual(["Close", "Read the guide", "Tell me how it goes"]);
    click(m, "Read the guide");
    expect(open).toHaveBeenCalledWith(GUIDE_URL);
  });
  it("What changed opens the release page for the exact version; Close opens nothing", () => {
    const open = vi.fn();
    const m = new ReleaseNoteModal(new App(), "update", "0.11.2", open);
    m.open();
    click(m, "Close");
    expect(open).not.toHaveBeenCalled();
    m.open();
    click(m, "What changed");
    expect(open).toHaveBeenCalledWith(RELEASE_URL("0.11.2"));
  });
  it("closing empties the content so a reopen never doubles it", () => {
    const m = new ReleaseNoteModal(new App(), "update", "0.11.0", () => undefined);
    m.open(); m.close(); m.open();
    expect(m.contentEl.querySelectorAll("li").length).toBe(3);
  });
});
