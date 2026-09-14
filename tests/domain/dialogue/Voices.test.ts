import { describe, it, expect } from "vitest";
import { attributeBlocks, pinBlock } from "../../../src/domain/dialogue/Voices";
import { DEFAULT_CONVENTIONS } from "../../../src/domain/dialogue/DialogueSpans";
import type { Speaker } from "../../../src/domain/dialogue/Speakers";

const roster: Speaker[] = [{ id: "m", name: "Mara", aliases: [], colour: "#1", accent: [], accentNever: [] }, { id: "t", name: "Tomas", aliases: [], colour: "#2", accent: [], accentNever: [] }];

describe("attributeBlocks", () => {
  it("runs the dialogue analysis over the page's blocks, a heading starting the scene over, a pin read and blanked", () => {
    const out = attributeBlocks([
      { text: "Mara came in." }, { text: "“You came alone?” Tomas did not look up." }, { text: "“Yes.”" }, { text: "# Two" }, { text: "%% Mara %% _A thought._" }, { text: "%% not speech %% “A sign.”" },
    ], DEFAULT_CONVENTIONS, roster);
    expect(out.map((b) => [b.spans.length, b.attribution ? `${b.attribution.speaker.name}/${b.attribution.how}` : null])).toEqual([[0, null], [1, "Tomas/named"], [1, "Mara/turns"], [0, null], [1, "Mara/pinned"], [0, null]]);
    expect(out[5]!.pin?.notSpeech).toBe(true);
    expect(out[4]!.voices[0]?.how).toBe("pinned");
  });
});

describe("pinBlock", () => {
  it("writes, replaces and removes the pin before a block's sentence", () => {
    const md = "Mara looked up. “Yes.” “No.”";
    const [v] = attributeBlocks([{ text: md }], DEFAULT_CONVENTIONS, roster);
    expect(pinBlock(md, v!, 1, "Tomas")).toBe("Mara looked up. “Yes.” %% Tomas %% “No.”");
    const pinned = pinBlock(md, v!, 0, "Tomas");
    expect(pinned).toBe("Mara looked up. %% Tomas %% “Yes.” “No.”");
    const [w] = attributeBlocks([{ text: pinned }], DEFAULT_CONVENTIONS, roster);
    expect(pinBlock(pinned, w!, 0, "Mara")).toBe("Mara looked up. %% Mara %% “Yes.” “No.”");
    expect(pinBlock(pinned, w!, 0, null)).toBe(md);
    expect(pinBlock(md, v!, 9, "Mara")).toBe(md);
  });
});
