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

  it("handles empty input", () => {
    expect(tagger.tag("")).toEqual([]);
  });
});
