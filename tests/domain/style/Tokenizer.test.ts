import { describe, it, expect } from "vitest";
import { tokenize } from "../../../src/domain/style/Tokenizer";

describe("tokenize", () => {
  it("yields lowercase word tokens with exact offsets", () => {
    const t = tokenize('She said, "Don\'t!"');
    expect(t.map((x) => x.text)).toEqual(["she", "said", "don't"]);
    expect(t[2]).toMatchObject({ from: 11, to: 16 });
  });
  it("normalises curly apostrophes", () => {
    expect(tokenize("don’t").map((x) => x.text)).toEqual(["don't"]);
  });
  it("keeps hyphenated words whole", () => {
    expect(tokenize("well-known").map((x) => x.text)).toEqual(["well-known"]);
  });
  it("records whether a sentence boundary precedes the token", () => {
    const t = tokenize("End. Start again! Go");
    expect(t.map((x) => x.startsSentence)).toEqual([true, true, false, true]);
  });
});
