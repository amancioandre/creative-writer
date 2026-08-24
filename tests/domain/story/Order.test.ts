import { describe, it, expect } from "vitest";
import { compareNotes, storyOrderOf } from "../../../src/domain/story/Order";

const n = (path: string, frontmatter: unknown = {}) => ({ path, frontmatter });

describe("story order", () => {
  it("reads a number, a numeric string, and nothing else", () => {
    expect(storyOrderOf({ "story-order": 3 })).toBe(3);
    expect(storyOrderOf({ "story-order": "12" })).toBe(12);
    expect(storyOrderOf({ "story-order": "2.5" })).toBe(2.5);
    expect(storyOrderOf({ "story-order": "later" })).toBeNull();
    expect(storyOrderOf({ "story-order": NaN })).toBeNull();
    expect(storyOrderOf({})).toBeNull();
    expect(storyOrderOf(null)).toBeNull();
  });

  it("puts ordered notes first by number, then the rest by path", () => {
    const notes = [n("Novel/B.md"), n("Novel/A.md"), n("Novel/Z.md", { "story-order": 1 }), n("Novel/C.md", { "story-order": 2 })];
    expect([...notes].sort(compareNotes).map((x) => x.path)).toEqual(["Novel/Z.md", "Novel/C.md", "Novel/A.md", "Novel/B.md"]);
  });

  it("breaks a tie between equal orders by path, so the sort stays deterministic", () => {
    const notes = [n("Novel/B.md", { "story-order": 1 }), n("Novel/A.md", { "story-order": "1" })];
    expect([...notes].sort(compareNotes).map((x) => x.path)).toEqual(["Novel/A.md", "Novel/B.md"]);
  });
});
