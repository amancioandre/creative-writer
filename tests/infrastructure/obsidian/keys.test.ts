import { describe, it, expect } from "vitest";
import { inField, isActivationKey, onActivate } from "../../../src/infrastructure/obsidian/views/keys";

const key = (el: Element, k: string) => { const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev; };

describe("onActivate", () => {
  it("gives a plain element the role and a tab stop, and runs on click, Enter and Space", () => {
    const el = document.body.createDiv();
    const runs: string[] = [];
    onActivate(el, (ev) => runs.push(ev.type));
    expect(el.getAttribute("role")).toBe("button");
    expect(el.getAttribute("tabindex")).toBe("0");
    el.click();
    const enter = key(el, "Enter");
    const space = key(el, " ");
    expect(runs).toEqual(["click", "keydown", "keydown"]);
    // Space must not scroll the pane, Enter must not reach a surrounding handler.
    expect(enter.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    key(el, "ArrowDown");
    expect(runs).toHaveLength(3);
  });

  it("leaves an existing role and tab stop alone, and can skip the role for SVG shapes", () => {
    const el = document.body.createDiv({ attr: { role: "link", tabindex: "-1" } });
    onActivate(el, () => undefined);
    expect(el.getAttribute("role")).toBe("link");
    expect(el.getAttribute("tabindex")).toBe("-1");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    onActivate(rect, () => undefined, { role: false });
    expect(rect.getAttribute("role")).toBeNull();
    expect(rect.getAttribute("tabindex")).toBe("0");
  });

  it("only answers keys that started on the element itself", () => {
    const el = document.body.createDiv();
    const inner = el.createEl("input");
    let runs = 0;
    onActivate(el, () => { runs += 1; });
    key(inner, "Enter");
    expect(runs).toBe(0);
    expect(inField(new KeyboardEvent("keydown", { key: "a" }))).toBe(false);
    expect(isActivationKey(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(true);
    expect(isActivationKey(new KeyboardEvent("keydown", { key: "a" }))).toBe(false);
  });
});
