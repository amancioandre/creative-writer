import { describe, it, expect, afterEach } from "vitest";
import { focusFadeExtension } from "../../../src/infrastructure/codemirror/focusFadeExtension";
import { mount, type Harness } from "./helpers";

const DOC = ["l0", "l1", "l2", "l3", "l4", "l5", "l6"].join("\n");
const tierOf = (el: HTMLElement) => [...el.classList].find((c) => c.startsWith("czm-focus-"))?.replace("czm-focus-", "");

describe("focusFadeExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("marks the cursor line as tier 0 and fades outward", () => {
    h = mount(DOC, focusFadeExtension());
    h.moveCursor(9); // start of l3
    expect(h.lineEls().map(tierOf)).toEqual(["3", "2", "1", "0", "1", "2", "3"]);
  });

  it("updates when the cursor moves", () => {
    h = mount(DOC, focusFadeExtension());
    h.moveCursor(0);
    expect(tierOf(h.lineEls()[0]!)).toBe("0");
    h.moveCursor(DOC.length);
    expect(tierOf(h.lineEls()[6]!)).toBe("0");
    expect(tierOf(h.lineEls()[0]!)).toBe("3");
  });

  it("updates when text is typed (doc change moves the cursor line)", () => {
    h = mount(DOC, focusFadeExtension());
    h.moveCursor(0);
    h.type("x\n");
    expect(tierOf(h.lineEls()[1]!)).toBe("0");
  });

  it("adds nothing when disabled in settings, and re-adds when enabled", () => {
    h = mount(DOC, focusFadeExtension(), { focusFadeEnabled: false });
    h.moveCursor(0);
    expect(h.lineEls().every((el) => tierOf(el) === undefined)).toBe(true);
    h.setSettings({ focusFadeEnabled: true });
    expect(tierOf(h.lineEls()[0]!)).toBe("0");
    h.setSettings({ focusFadeEnabled: false });
    expect(h.lineEls().every((el) => tierOf(el) === undefined)).toBe(true);
  });

  it("tags the editor root so CSS can scope the fade", () => {
    h = mount(DOC, focusFadeExtension());
    expect(h.view.dom.classList.contains("czm-focus-fade")).toBe(true);
    h.setSettings({ focusFadeEnabled: false });
    expect(h.view.dom.classList.contains("czm-focus-fade")).toBe(false);
  });
});
