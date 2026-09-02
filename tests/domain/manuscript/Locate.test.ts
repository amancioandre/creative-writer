import { describe, it, expect } from "vitest";
import { locateInBlock } from "../../../src/domain/manuscript/Locate";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";

const seg = new IntlSentenceSegmenter();
const locate = (raw: string, rendered: string, offset: number) => locateInBlock(raw, rendered, seg.segment(rendered), offset);

describe("locateInBlock", () => {
  it("finds the sentence under the click through emphasis and links", () => {
    const raw = "Marta woke *before* Ilse. She walked to the [[Lisbon|gate]].\nZsófi was there.";
    const rendered = "Marta woke before Ilse. She walked to the gate.\nZsófi was there.";
    expect(locate(raw, rendered, 2)).toEqual({ line: 0, ch: 0 });
    expect(locate(raw, rendered, rendered.indexOf("walked"))).toEqual({ line: 0, ch: raw.indexOf("She") });
    expect(locate(raw, rendered, rendered.indexOf("there"))).toEqual({ line: 1, ch: 0 });
  });

  it("picks the right one of two sentences that open alike", () => {
    const raw = "She said stop. She said *go*.";
    const rendered = "She said stop. She said go.";
    expect(locate(raw, rendered, rendered.indexOf("go"))).toEqual({ line: 0, ch: raw.indexOf("She said *") });
  });

  it("skips words that occur earlier inside another sentence", () => {
    const raw = "I told her the gate was shut. The gate opened.";
    expect(locate(raw, raw, raw.indexOf("opened"))).toEqual({ line: 0, ch: raw.indexOf("The gate") });
  });

  it("falls back to the block start when nothing matches or the block is empty", () => {
    expect(locate("# Camp", "Camp", 1)).toEqual({ line: 0, ch: 2 });
    expect(locate("***", "", 0)).toEqual({ line: 0, ch: 0 });
    expect(locate("x", "totally different", 3)).toEqual({ line: 0, ch: 0 });
  });

  it("answers past the end with the last sentence", () => {
    const raw = "One. Two.";
    expect(locate(raw, raw, 50)).toEqual({ line: 0, ch: 5 });
  });
});
