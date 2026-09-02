import { describe, it, expect } from "vitest";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { refLinks } from "../../../src/domain/writer/Uses";

/**
 * The board is private: what a scene sends to a model is its prose, and a
 * REF comment is a comment, so it never reaches the prose the analysers
 * read. The board still counts it.
 */
describe("writer privacy", () => {
  const text = "# Camp\nHe walked. %% REF: [[Invictus]] %% He kept walking.\n%% REF: [[Courage]] %%\n\nA second paragraph. %% CHECK: was it a coat? %%\n";
  it("keeps REF comments out of scene prose, the text every model reading is built from", () => {
    const prose = splitScenes(text).map((s) => s.prose).join("\n");
    expect(prose).not.toContain("%%");
    expect(prose).not.toContain("REF");
    expect(prose).not.toContain("Invictus");
    expect(prose.replace(/\s+/g, " ")).toContain("He walked. He kept walking.");
  });
  it("still lets the board count them", () => {
    expect(refLinks(text)).toEqual(["Invictus", "Courage"]);
  });
});
