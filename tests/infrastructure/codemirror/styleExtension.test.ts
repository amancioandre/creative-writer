import { describe, it, expect, afterEach } from "vitest";
import { styleExtension, findingAt, tooltipFor } from "../../../src/infrastructure/codemirror/styleExtension";
import { AnalyzeParagraphStyle } from "../../../src/application/use-cases/AnalyzeParagraphStyle";
import { Finding } from "../../../src/domain/style/Finding";
import { mount, type Harness } from "./helpers";

const DOC = "At the end of the day she was seen.\n\nClean paragraph here.";
const marks = (h: Harness) => Array.from(h.view.dom.querySelectorAll<HTMLElement>("[class*='czm-style-']"));
const ext = () => styleExtension(AnalyzeParagraphStyle.withDefaultRules());

describe("styleExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("marks findings in the cursor paragraph with kind classes and the note", () => {
    h = mount(DOC, ext());
    h.moveCursor(1);
    const ms = marks(h);
    expect(ms.map((m) => m.textContent)).toEqual(["At the end of the day", "was seen"]);
    expect(ms[0]!.classList.contains("czm-style-cliche")).toBe(true);
    expect(ms[1]!.classList.contains("czm-style-passive")).toBe(true);
    expect(ms[0]!.getAttribute("data-czm-note")).toMatch(/Cliché/);
  });

  it("only decorates the cursor's paragraph", () => {
    h = mount(DOC, ext());
    h.moveCursor(DOC.length - 1);
    expect(marks(h)).toHaveLength(0);
  });

  it("honours per-kind toggles", () => {
    h = mount(DOC, ext(), { styleChecks: { cliche: false, passive: true, weak: true, filter: true, adverb: true, repetition: true } });
    h.moveCursor(1);
    expect(marks(h).map((m) => m.textContent)).toEqual(["was seen"]);
  });

  it("does nothing when the feature is off", () => {
    h = mount(DOC, ext(), { styleEnabled: false });
    h.moveCursor(1);
    expect(marks(h)).toHaveLength(0);
  });
});

describe("findingAt", () => {
  const fs = [Finding.create("weak", 5, 9, "a"), Finding.create("adverb", 20, 26, "b")];
  it("returns the finding covering a position (inclusive of the end, for hover)", () => {
    expect(findingAt(fs, 5)?.note).toBe("a");
    expect(findingAt(fs, 9)?.note).toBe("a");
    expect(findingAt(fs, 22)?.note).toBe("b");
  });
  it("returns null between findings", () => {
    expect(findingAt(fs, 12)).toBeNull();
  });
});

describe("hover tooltip", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("renders kind and note for the finding under the pointer", () => {
    const t = tooltipFor(Finding.create("passive", 3, 9, "Who did it?"));
    const { dom } = t.create(undefined as never);
    expect(dom.querySelector(".czm-style-tooltip-kind")!.textContent).toBe("passive");
    expect(dom.textContent).toContain("Who did it?");
    expect(t).toMatchObject({ pos: 3, end: 9 });
  });

  it("source resolves a finding from the live plugin, and null elsewhere", () => {
    const e = ext();
    h = mount(DOC, e);
    h.moveCursor(1);
    expect(e.source(h.view, 2)?.pos).toBe(0);
    expect(e.source(h.view, DOC.length - 2)).toBeNull();
  });
});
