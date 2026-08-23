import { describe, it, expect } from "vitest";
import { validateFindings, type RawFinding } from "../../../../src/domain/style/llm/validateFindings";

const text = "The silence bruised him. At the end of the day he left. The silence returned.";
const raw = (r: Partial<RawFinding>): RawFinding => ({ kind: "metaphor", quote: "silence bruised", note: "n", ...r });

describe("validateFindings", () => {
  it("anchors a finding by locating its quote in the text", () => {
    const [f] = validateFindings([raw({})], text);
    expect(f).toMatchObject({ kind: "metaphor", from: 4, to: 19, note: "n" });
  });

  it("ignores model-supplied offsets when they disagree with the quote", () => {
    const [f] = validateFindings([raw({ start: 0, end: 3 })], text);
    expect(text.slice(f!.from, f!.to)).toBe("silence bruised");
  });

  it("uses offsets as a hint to pick the right occurrence of a repeated quote", () => {
    const second = text.lastIndexOf("The silence");
    const [f] = validateFindings([raw({ quote: "The silence", start: second - 2 })], text);
    expect(f!.from).toBe(second);
  });

  it("matches quotes loosely: case, straight/curly quotes, collapsed whitespace", () => {
    const t = 'He said “don’t”.  Then   left.';
    const [f] = validateFindings([raw({ quote: 'he said "don\'t"' })], t);
    expect(t.slice(f!.from, f!.to)).toBe("He said “don’t”");
  });

  it("drops findings whose quote is not in the text", () => {
    expect(validateFindings([raw({ quote: "nowhere" })], text)).toEqual([]);
  });

  it("drops findings with unknown kinds", () => {
    expect(validateFindings([raw({ kind: "vibes" as never })], text)).toEqual([]);
  });

  it("drops empty quotes and empty notes", () => {
    expect(validateFindings([raw({ quote: "" }), raw({ note: "  " })], text)).toEqual([]);
  });

  it("drops duplicates and overlapping findings of the same kind, keeping the first", () => {
    const out = validateFindings([raw({}), raw({ quote: "bruised him" }), raw({ quote: "silence bruised" })], text);
    expect(out).toHaveLength(1);
  });

  it("keeps overlapping findings of different kinds", () => {
    const out = validateFindings([raw({}), raw({ kind: "cliche", quote: "silence bruised" })], text);
    expect(out).toHaveLength(2);
  });

  it("returns findings sorted by position", () => {
    const out = validateFindings([raw({ kind: "cliche", quote: "At the end of the day" }), raw({})], text);
    expect(out.map((f) => f.from)).toEqual([4, 25]);
  });

  it("tolerates junk input shapes", () => {
    expect(validateFindings([null, 1, {}, { kind: "metaphor" }] as never, text)).toEqual([]);
  });

  it("trims the note and caps its length", () => {
    const [f] = validateFindings([raw({ note: "  " + "x".repeat(1000) })], text);
    expect(f!.note.length).toBeLessThanOrEqual(400);
  });
});
