import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { couldNot, SAY_MS, StatusLine, UNDO_MS } from "../../../src/infrastructure/obsidian/views/StatusLine";

describe("StatusLine", () => {
  let host: HTMLElement;
  let line: StatusLine;
  beforeEach(() => { vi.useFakeTimers(); host = document.body.createDiv(); line = new StatusLine(host); });
  afterEach(() => { vi.useRealTimers(); host.remove(); });

  it("is a polite live region that opens with a message and closes when it passes", () => {
    expect(line.el.getAttribute("aria-live")).toBe("polite");
    expect(line.el.classList.contains("is-open")).toBe(false);
    line.say("Card moved");
    expect(line.el.textContent).toBe("Card moved");
    expect(line.el.classList.contains("is-open")).toBe(true);
    vi.advanceTimersByTime(SAY_MS);
    expect(line.text).toBe("");
    expect(line.el.classList.contains("is-open")).toBe(false);
  });

  it("offers an Undo button that runs the undo once and clears the line", async () => {
    const undone: string[] = [];
    line.undoable("Courage taken out of Themes", async () => { undone.push("courage"); });
    const btn = line.el.querySelector<HTMLButtonElement>(".czm-status-undo")!;
    expect(btn.textContent).toBe("Undo");
    btn.click();
    await Promise.resolve();
    expect(undone).toEqual(["courage"]);
    expect(line.text).toBe("");
    expect(line.el.querySelector(".czm-status-undo")).toBeNull();
  });

  it("withdraws the undo after its time, but not while a newer message replaced it", () => {
    line.undoable("A", async () => undefined);
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(line.text).toBe("A");
    line.say("B");
    vi.advanceTimersByTime(1);
    expect(line.text).toBe("B");
    vi.advanceTimersByTime(SAY_MS);
    expect(line.text).toBe("");
  });

  it("keeps a failure on screen as an alert until something else happens", () => {
    line.fail(couldNot("move the card", new Error("note is read-only")));
    expect(line.el.textContent).toBe("Could not move the card: note is read-only");
    expect(line.el.getAttribute("role")).toBe("alert");
    expect(line.el.classList.contains("is-error")).toBe(true);
    vi.advanceTimersByTime(UNDO_MS * 10);
    expect(line.text).toContain("read-only");
    line.say("Moved");
    expect(line.el.getAttribute("role")).toBeNull();
    expect(line.el.classList.contains("is-error")).toBe(false);
  });

  it("reports a failed undo instead of losing it", async () => {
    line.undoable("Removed", async () => { throw new Error("gone"); });
    line.el.querySelector<HTMLButtonElement>(".czm-status-undo")!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(line.text).toBe("Could not undo: gone");
    expect(line.el.getAttribute("role")).toBe("alert");
  });

  it("holds a state message until it is cleared or replaced", () => {
    line.hold("Reading…");
    vi.advanceTimersByTime(UNDO_MS * 10);
    expect(line.text).toBe("Reading…");
    line.clear();
    expect(line.text).toBe("");
    expect(line.el.classList.contains("is-open")).toBe(false);
  });

  it("carries one named action that is not an undo", () => {
    const host = document.createElement("div");
    const line = new StatusLine(host);
    let ran = 0;
    line.action("Wrote a note", "Open", () => { ran++; });
    expect(line.el.textContent).toBe("Wrote a noteOpen");
    (line.el.querySelector(".czm-status-action") as HTMLElement).click();
    expect(ran).toBe(1);
    expect(line.text).toBe("");
  });
});
