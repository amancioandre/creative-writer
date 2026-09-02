import { describe, it, expect } from "vitest";
import { groupsFromTags, hasWriterTag, normalizePrefix, writerTag } from "../../../src/domain/writer/Tags";

describe("Tags", () => {
  it("reads group ids from tags under the prefix, with or without #, any case, deduplicated, in order", () => {
    expect(groupsFromTags(["#writer/theme", "writer/Quote", "#Writer/theme", "#other/theme", "plain"])).toEqual(["theme", "quote"]);
  });
  it("takes the first segment after the prefix and sends a bare prefix tag to Unsorted", () => {
    expect(groupsFromTags(["#writer/theme/dark"])).toEqual(["theme"]);
    expect(groupsFromTags(["#writer"])).toEqual(["unsorted"]);
    expect(groupsFromTags(["#writer/"])).toEqual(["unsorted"]);
  });
  it("honours another prefix", () => {
    expect(groupsFromTags(["#writer/theme", "#me/theme"], "me")).toEqual(["theme"]);
    expect(hasWriterTag(["#writer/theme"], "me")).toBe(false);
    expect(hasWriterTag(["#me/theme"], "me")).toBe(true);
  });
  it("normalises a prefix and builds a tag", () => {
    expect(normalizePrefix(" #Writer/ ")).toBe("writer");
    expect(normalizePrefix("")).toBe("writer");
    expect(normalizePrefix(3)).toBe("writer");
    expect(normalizePrefix("me")).toBe("me");
    expect(writerTag("writer", "theme")).toBe("writer/theme");
  });
});
