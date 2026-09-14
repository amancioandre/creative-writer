import { describe, it, expect } from "vitest";
import { attributeBlocks, pinLine } from "../../../src/domain/dialogue/Voices";
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
  });
});

describe("pinLine", () => {
  const note = "# One\n\n“Yes.”\n\n  %% Mara %% “No.”";
  it("writes, replaces and removes a pin on one line, keeping indentation", () => {
    expect(pinLine(note, 2, "Tomas").split("\n")[2]).toBe("%% Tomas %% “Yes.”");
    expect(pinLine(note, 4, "Tomas").split("\n")[4]).toBe("  %% Tomas %% “No.”");
    expect(pinLine(note, 4, null).split("\n")[4]).toBe("  “No.”");
    expect(pinLine(note, 2, null)).toBe(note);
  });
  it("clamps the line", () => {
    expect(pinLine("a", 9, "Mara")).toBe("%% Mara %% a");
  });
});
