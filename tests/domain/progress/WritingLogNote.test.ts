import { describe, it, expect } from "vitest";
import { EMPTY_LOG } from "../../../src/domain/progress/WritingLog";
import { isLogEmpty, parseWritingLogNote, serializeWritingLogNote } from "../../../src/domain/progress/WritingLogNote";

const log = { days: { "2026-08-24": { added: 5, removed: 1, files: { "a.md": { added: 5, removed: 1 } } } }, counts: { "a.md": 40 } };

describe("WritingLogNote", () => {
  it("round-trips through a flagged markdown note", () => {
    const md = serializeWritingLogNote(log);
    expect(md.startsWith("---\ncreative-writer: false\ncreative-writer-log: 1\n---")).toBe(true);
    expect(parseWritingLogNote(md)).toEqual(log);
  });
  it("is empty for a note without a block or with bad JSON", () => {
    expect(parseWritingLogNote("words")).toEqual(EMPTY_LOG);
    expect(parseWritingLogNote("```json\n{oops\n```")).toEqual(EMPTY_LOG);
  });
  it("knows an empty log", () => {
    expect(isLogEmpty(EMPTY_LOG)).toBe(true);
    expect(isLogEmpty(log)).toBe(false);
    expect(isLogEmpty({ days: {}, counts: { "a.md": 1 } })).toBe(false);
  });
});
