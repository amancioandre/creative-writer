import { describe, it, expect, afterEach } from "vitest";
import { rhythmExtension, ticksFor, RHYTHM_GUTTER_LAYER_CLASS, TICK_GAP, TICK_GUTTER, TICK_HEIGHT, TICK_MAX_WIDTH, TICK_MIN_WIDTH } from "../../../src/infrastructure/codemirror/rhythmExtension";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";
import { AnalyzeParagraphRhythm } from "../../../src/application/use-cases/AnalyzeParagraphRhythm";
import { mount, type Harness } from "./helpers";

const P1 = "Go. This second sentence runs noticeably longer than the first one did.";
const P2 = "Untouched paragraph here. It must not be decorated.";
const DOC = `${P1}\n\n${P2}`;

const marks = (h: Harness) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(".cm-line [class*='czm-rhythm-']"));
const tierOf = (el: HTMLElement) => Number([...el.classList].find((c) => /^czm-rhythm-\d$/.test(c))!.slice(-1));

const ext = () => rhythmExtension(new AnalyzeParagraphRhythm(new IntlSentenceSegmenter("en")));

describe("rhythmExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("decorates only the paragraph containing the cursor", () => {
    h = mount(DOC, ext());
    h.moveCursor(1);
    const ms = marks(h);
    expect(ms.length).toBe(2);
    expect(ms.map((m) => m.textContent)).toEqual(["Go.", "This second sentence runs noticeably longer than the first one did."]);
    expect(tierOf(ms[0]!)).toBe(1);
    expect(tierOf(ms[1]!)).toBeGreaterThan(1);
  });

  it("moves the decoration when the cursor moves to another paragraph", () => {
    h = mount(DOC, ext());
    h.moveCursor(1);
    h.moveCursor(DOC.length - 1);
    const texts = marks(h).map((m) => m.textContent);
    expect(texts).toEqual(["Untouched paragraph here.", "It must not be decorated."]);
  });

  it("clears decorations when the cursor sits on a blank line", () => {
    h = mount(DOC, ext());
    h.moveCursor(1);
    h.moveCursor(P1.length + 1); // the blank line
    expect(marks(h)).toHaveLength(0);
  });

  it("re-analyses as the user types", () => {
    h = mount("Short.", ext());
    h.moveCursor(6);
    const before = tierOf(marks(h)[0]!);
    h.type(" And now it keeps going and going, clause after clause, until the sentence is quite long indeed.");
    const after = marks(h);
    expect(after).toHaveLength(2);
    expect(tierOf(after[1]!)).toBeGreaterThan(before);
  });

  it("respects the tier count setting", () => {
    const long = Array.from({ length: 80 }, () => "word").join(" ") + ".";
    h = mount(long, ext(), { rhythmTiers: 4 });
    h.moveCursor(0);
    expect(tierOf(marks(h)[0]!)).toBe(4);
    h.setSettings({ rhythmTiers: 6 });
    expect(tierOf(marks(h)[0]!)).toBe(6);
  });

  it("does nothing when disabled", () => {
    h = mount(DOC, ext(), { rhythmEnabled: false });
    h.moveCursor(1);
    expect(marks(h)).toHaveLength(0);
  });

  it("mounts the Zen Mode meter as a below-text layer that survives cursor moves", () => {
    h = mount(DOC, ext());
    const layerEl = h.view.scrollDOM.querySelector<HTMLElement>(`.cm-layer.${RHYTHM_GUTTER_LAYER_CLASS}`);
    expect(layerEl).not.toBeNull();
    expect(layerEl!.classList.contains("cm-layer-above")).toBe(false);
    h.moveCursor(1);
    h.moveCursor(DOC.length - 1);
    h.setSettings({ rhythmEnabled: false });
    expect(h.view.scrollDOM.querySelector(`.${RHYTHM_GUTTER_LAYER_CLASS}`)).not.toBeNull();
  });
});

describe("ticksFor", () => {
  const anchor = { top: 100, left: 300 };

  it("stacks one bar per sentence down from the paragraph's top, all starting at the same x in the margin", () => {
    const ticks = ticksFor([1, 3, 6], 6, anchor);
    expect(ticks.map((t) => t.top)).toEqual([100, 100 + TICK_HEIGHT + TICK_GAP, 100 + 2 * (TICK_HEIGHT + TICK_GAP)]);
    expect(new Set(ticks.map((t) => t.left)).size).toBe(1);
    expect(ticks[0]!.left + TICK_MAX_WIDTH + TICK_GUTTER).toBe(anchor.left);
  });

  it("grows the bar with the tier, the top tier reaching the full width", () => {
    const [short, mid, long] = ticksFor([1, 3, 6], 6, anchor);
    expect(short!.width).toBeLessThan(mid!.width);
    expect(mid!.width).toBeLessThan(long!.width);
    expect(long!.width).toBe(TICK_MAX_WIDTH);
    expect(ticksFor([1], 4, anchor)[0]!.width).toBe(Math.round(TICK_MAX_WIDTH / 4));
  });

  it("keeps a sentence visible even at the lowest tier of many", () => {
    expect(ticksFor([1], 100, anchor)[0]!.width).toBe(TICK_MIN_WIDTH);
    expect(ticksFor([], 6, anchor)).toEqual([]);
  });
});
