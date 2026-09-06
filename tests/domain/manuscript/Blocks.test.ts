import { describe, it, expect } from "vitest";
import { splitBlocks } from "../../../src/domain/manuscript/Blocks";

describe("splitBlocks", () => {
  it("cuts at blank lines and headings, keeping line ranges", () => {
    const md = "---\ntitle: x\n---\n# Camp\nOne line.\nSecond line.\n\nNext paragraph.\n## Creek\nAlone.";
    const blocks = splitBlocks(md);
    expect(blocks.map((b) => [b.kind, b.from, b.to])).toEqual([
      ["heading", 3, 3], ["paragraph", 4, 5], ["paragraph", 7, 7], ["heading", 8, 8], ["paragraph", 9, 9],
    ]);
    expect(blocks[0]).toMatchObject({ heading: 1, headingText: "Camp", markdown: "# Camp" });
    expect(blocks[1]!.markdown).toBe("One line.\nSecond line.");
  });

  it("keeps a fence whole and unclosed fences to the end", () => {
    const blocks = splitBlocks("Text.\n```js\nlet a;\n\nlet b;\n```\nAfter.\n~~~\nopen");
    expect(blocks.map((b) => [b.kind, b.from, b.to])).toEqual([["paragraph", 0, 0], ["code", 1, 5], ["paragraph", 6, 6], ["code", 7, 8]]);
  });

  it("types lists, quotes, callouts, tables, html, rules and block comments", () => {
    const md = "- a\n- b\n\n> a letter\n\n> [!note]\n> aside\n\n| a | b |\n|---|---|\n\n<div>x</div>\n\n***\n\n%%\nhidden\n%%\n\nNot ***bold*** rule.";
    expect(splitBlocks(md).map((b) => b.kind)).toEqual(["list", "quote", "callout", "table", "html", "rule", "comment", "paragraph"]);
  });

  it("treats an inline comment as part of its paragraph", () => {
    const blocks = splitBlocks("Marta %% fix this %% woke.\n%% whole line %%\n");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("paragraph");
  });

  it("keeps a paragraph whose first sentence is commented out", () => {
    const one = splitBlocks("%%Marta woke.%% The camp was quiet.");
    expect(one.map((b) => [b.kind, b.from, b.to])).toEqual([["paragraph", 0, 0]]);
    const spanning = splitBlocks("%% Marta woke.\nShe stretched. %% The camp was quiet.\nSnow fell.\n\nNext.");
    expect(spanning.map((b) => [b.kind, b.from, b.to])).toEqual([["paragraph", 0, 2], ["paragraph", 4, 4]]);
  });

  it("hides whole-line comments as blocks unless they sit inside a paragraph", () => {
    expect(splitBlocks("%% alone %%\n\nProse.").map((b) => b.kind)).toEqual(["comment", "paragraph"]);
    expect(splitBlocks("%% a %% %% b %%\nProse.").map((b) => [b.kind, b.from, b.to])).toEqual([["comment", 0, 0], ["paragraph", 1, 1]]);
    expect(splitBlocks("Prose.\n%%\nlong note\n%%\nMore.").map((b) => [b.kind, b.from, b.to])).toEqual([["paragraph", 0, 0], ["comment", 1, 3], ["paragraph", 4, 4]]);
    expect(splitBlocks("Prose.\n%% never closed\nstill hidden").map((b) => [b.kind, b.from, b.to])).toEqual([["paragraph", 0, 0], ["comment", 1, 2]]);
  });

  it("returns nothing for an empty note", () => {
    expect(splitBlocks("")).toEqual([]);
    expect(splitBlocks("---\na: 1\n---\n")).toEqual([]);
  });
});
