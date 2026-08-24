import { describe, it, expect } from "vitest";
import { CompromiseTagger } from "../../../src/infrastructure/nlp/CompromiseTagger";

describe("CompromiseTagger", () => {
  const tagger = new CompromiseTagger();

  it("returns tokens with exact offsets into the original text", () => {
    const text = 'She said, "Don\'t go!" quietly.';
    for (const t of tagger.tag(text)) expect(text.slice(t.from, t.to)).toBe(t.text);
  });

  it("tags parts of speech", () => {
    const toks = tagger.tag("The letter was written quickly.");
    const by = Object.fromEntries(toks.map((t) => [t.text.toLowerCase(), t]));
    expect(by.letter!.tags.has("Noun")).toBe(true);
    expect(by.written!.tags.has("Participle")).toBe(true);
    expect(by.quickly!.tags.has("Adverb")).toBe(true);
  });

  it("exposes the sentence index so rules can scope per sentence", () => {
    const toks = tagger.tag("One here. Two there.");
    expect(toks.map((t) => t.sentence)).toEqual([0, 0, 1, 1]);
  });

  it("derives lemmas for irregular forms", () => {
    const by = Object.fromEntries(tagger.tag("The idea bled. Knives fell.").map((t) => [t.normal, t.lemma]));
    expect(by.bled).toBe("bleed");
    expect(by.knives).toBe("knife");
  });

  it("ends a sentence at an ellipsis followed by a capital, with offsets intact", () => {
    for (const text of ["and the office… The office grew.", "He waited... \"The door,\" she said."]) {
      const toks = tagger.tag(text);
      for (const t of toks) expect(text.slice(t.from, t.to)).toBe(t.text);
      expect(new Set(toks.map((t) => t.sentence)).size).toBe(2);
      const the = toks.find((t) => t.text === "The")!;
      expect(the.tags.has("Determiner")).toBe(true);
      expect(the.tags.has("ProperNoun")).toBe(false);
    }
  });

  it("does not split at a mid-sentence ellipsis followed by lowercase", () => {
    expect(new Set(tagger.tag("She waited… and then she left.").map((t) => t.sentence)).size).toBe(1);
  });

  it("handles empty input", () => {
    expect(tagger.tag("")).toEqual([]);
  });
});
