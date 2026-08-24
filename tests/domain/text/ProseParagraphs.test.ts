import { describe, it, expect } from "vitest";
import { proseParagraphs, stripInlineMarkup } from "../../../src/domain/text/ProseParagraphs";

const doc = `---
title: Camp
---
# Scene: Mountain camp
- Unloading the truck
- Setting up

The road cuts up the pass.
It was steep.

> A quoted line of prose.

\`\`\`
code here. not prose.
\`\`\`

1. numbered
| a | b |

Final *emphasised* [[Link|alias]] paragraph with \`code\`.`;

describe("proseParagraphs", () => {
  const out = proseParagraphs(doc);

  it("keeps only prose paragraphs", () => {
    expect(out.map((p) => p.text)).toEqual([
      "The road cuts up the pass.\nIt was steep.",
      "A quoted line of prose.",
      "Final emphasised alias paragraph with .",
    ]);
  });

  it("records 0-based source line ranges", () => {
    expect(out[0]).toMatchObject({ firstLine: 7, lastLine: 8 });
    expect(out[1]).toMatchObject({ firstLine: 10, lastLine: 10 });
  });

  it("handles an empty document and one without front matter", () => {
    expect(proseParagraphs("")).toEqual([]);
    expect(proseParagraphs("Just prose.")).toEqual([{ text: "Just prose.", firstLine: 0, lastLine: 0 }]);
  });

  it("treats an unterminated front matter block as prose", () => {
    expect(proseParagraphs("---\nnot closed").map((p) => p.text)).toEqual(["not closed"]);
  });
});

describe("stripInlineMarkup", () => {
  it("keeps link text and drops decoration", () => {
    expect(stripInlineMarkup("**bold** _it_ ~~gone~~ ==hi== [text](http://x) ![[img.png]] %%note%%")).toBe("bold it gone hi text  ");
  });
});
