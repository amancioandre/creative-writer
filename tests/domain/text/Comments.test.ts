import { describe, it, expect } from "vitest";
import { commentLine, htmlComment, stripComments } from "../../../src/domain/text/Comments";
import { proseParagraphs } from "../../../src/domain/text/ProseParagraphs";
import { splitScenes } from "../../../src/domain/text/Scenes";

describe("stripComments", () => {
  it("removes HTML and Obsidian comments alike, inline", () => {
    expect(stripComments("She left <!-- too early --> at dawn %% check %%.")).toEqual({ text: "She left  at dawn .", state: null });
  });

  it("carries a block open across lines and closes it on the right marker", () => {
    const a = stripComments("Before <!-- starts here");
    expect(a).toEqual({ text: "Before ", state: "html" });
    const b = stripComments("still hidden %% not a closer", a.state);
    expect(b).toEqual({ text: "", state: "html" });
    const c = stripComments("ends --> after", b.state);
    expect(c).toEqual({ text: " after", state: null });
    expect(stripComments("x %% y", null).state).toBe("obsidian");
    expect(stripComments("-->", "obsidian")).toEqual({ text: "", state: "obsidian" });
  });

  it("writes the HTML form, softening a double hyphen XML would reject", () => {
    expect(htmlComment("  Kevin wins -- and knows it  ")).toBe("<!-- Kevin wins – and knows it -->");
    expect(commentLine("  <!-- Kevin wins a case -->  ")).toBe("Kevin wins a case");
    expect(commentLine("%% a pin %%")).toBe("a pin");
    expect(commentLine("prose <!-- with a note -->")).toBeNull();
  });
});

describe("comments in prose", () => {
  it("counts neither syntax as prose, on one line or several", () => {
    const doc = `# Scene\n<!-- Kevin wins a case he knows he should lose -->\nThe verdict came in. <!-- cut? --> Nobody moved.\n%% a pin %%\n<!--\n# not a heading\nnot prose either\n-->\nHe left.`;
    const out = proseParagraphs(doc);
    expect(out.map((p) => p.text)).toEqual(["The verdict came in.  Nobody moved.\nHe left."]);
    expect(splitScenes(doc).map((s) => [s.title, s.prose.split(/\s+/).length])).toEqual([["Scene", 8]]);
  });

  it("a heading with only a comment under it is still an outline heading", () => {
    const scenes = splitScenes(`## 1 Gainesville courtroom\n<!-- Kevin wins a case he knows he should lose -->\n\n## 4 The recess bathroom\nProse.`);
    expect(scenes.map((s) => [s.title, s.prose])).toEqual([["1 Gainesville courtroom", ""], ["4 The recess bathroom", "Prose."]]);
  });
});
