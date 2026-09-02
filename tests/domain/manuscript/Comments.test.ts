import { describe, it, expect } from "vitest";
import { DEFAULT_TAGS, colorOf, findAnnotations, splitTag } from "../../../src/domain/manuscript/Comments";

describe("splitTag", () => {
  it("reads an uppercase word and colon as the tag", () => {
    expect(splitTag(" TODO: cut this ")).toEqual({ tag: "TODO", body: "cut this" });
    expect(splitTag("FIX-2: x")).toEqual({ tag: "FIX-2", body: "x" });
  });
  it("treats anything else as untagged", () => {
    expect(splitTag("Check the gate")).toEqual({ tag: null, body: "Check the gate" });
    expect(splitTag("todo: lower")).toEqual({ tag: null, body: "todo: lower" });
    expect(splitTag("A: one letter")).toEqual({ tag: null, body: "A: one letter" });
  });
});

describe("findAnnotations", () => {
  it("finds comments and highlights with their positions and tags", () => {
    const md = "---\na: 1\n---\nMarta %% CHECK: the coat %% woke.\n==She stayed.== %%plain%%\n%%\nTODO: block\n%%";
    expect(findAnnotations(md)).toEqual([
      { kind: "comment", tag: "CHECK", text: "the coat", line: 3, ch: 6 },
      { kind: "highlight", tag: null, text: "She stayed.", line: 4, ch: 0 },
      { kind: "comment", tag: null, text: "plain", line: 4, ch: 16 },
      { kind: "comment", tag: "TODO", text: "block", line: 5, ch: 0 },
    ]);
  });

  it("ignores fences, the front matter and highlights inside comments", () => {
    const md = "---\nx: %% no %%\n---\n```\n%% TODO: in code %%\n```\n%% ==not a highlight== %%\n~~~\n==nor this==";
    expect(findAnnotations(md)).toEqual([{ kind: "comment", tag: null, text: "==not a highlight==", line: 6, ch: 0 }]);
  });

  it("is empty for prose without marks", () => {
    expect(findAnnotations("Just words. 100% sure == not a highlight.")).toEqual([]);
  });
});

describe("colorOf", () => {
  it("looks a tag up, case-sensitively", () => {
    expect(colorOf("TODO", DEFAULT_TAGS)).toBe("#d9a621");
    expect(colorOf("todo", DEFAULT_TAGS)).toBeNull();
    expect(colorOf(null, DEFAULT_TAGS)).toBeNull();
  });
});
