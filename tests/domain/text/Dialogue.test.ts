import { describe, it, expect } from "vitest";
import { countDialogueWords, countWords } from "../../../src/domain/text/Dialogue";

describe("countDialogueWords", () => {
  it("counts words inside straight quotes", () => {
    expect(countDialogueWords('She said, "Go home now." He left.')).toBe(3);
  });
  it("counts words inside curly quotes", () => {
    expect(countDialogueWords("“Where are you going?” she asked. “Out.”")).toBe(5);
  });
  it("handles several exchanges and text with no dialogue", () => {
    expect(countDialogueWords('"One." Pause. "Two three." Pause.')).toBe(3);
    expect(countDialogueWords("Nobody spoke all evening.")).toBe(0);
  });
  it("runs an unclosed quote to the end of the text", () => {
    expect(countDialogueWords('He began, "I never meant')).toBe(3);
  });
  it("does not count apostrophes as quotes", () => {
    expect(countDialogueWords("It's the dog's bed.")).toBe(0);
  });
});

describe("countWords", () => {
  it("counts hyphenated and contracted words once", () => {
    expect(countWords("don't over-think it")).toBe(3);
  });
});
