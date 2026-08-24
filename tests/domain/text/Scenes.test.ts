import { describe, it, expect } from "vitest";
import { splitScenes } from "../../../src/domain/text/Scenes";

const doc = `---
writing-target: 100
---
Opening lines before any heading.

# Act One
## Scene: Mountain camp
- a list
The road cuts up the pass. "Stop here," he said.

\`\`\`
# not a heading
\`\`\`

## Scene: The creek ##
Water everywhere.
# Act Two
`;

describe("splitScenes", () => {
  const scenes = splitScenes(doc);

  it("splits at headings of any level, keeping the preamble as level 0", () => {
    expect(scenes.map((s) => [s.title, s.level, s.line])).toEqual([
      ["", 0, 0],
      ["Act One", 1, 5],
      ["Scene: Mountain camp", 2, 6],
      ["Scene: The creek", 2, 14],
      ["Act Two", 1, 16],
    ]);
  });

  it("collects only the prose under each heading", () => {
    expect(scenes[0]!.prose).toBe("Opening lines before any heading.");
    expect(scenes[1]!.prose).toBe("");
    expect(scenes[2]!.prose).toBe('The road cuts up the pass. "Stop here," he said.');
    expect(scenes[3]!.prose).toBe("Water everywhere.");
    expect(scenes[4]!.prose).toBe("");
  });

  it("omits an empty preamble and handles a note with no headings", () => {
    expect(splitScenes("# Only\ntext").map((s) => s.title)).toEqual(["Only"]);
    expect(splitScenes("just prose")).toEqual([{ title: "", level: 0, line: 0, prose: "just prose" }]);
    expect(splitScenes("")).toEqual([]);
  });
});
