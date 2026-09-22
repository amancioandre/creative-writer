import { describe, it, expect } from "vitest";
import { describeScaffold, planScaffold, safeName, scaffoldPaths } from "../../../src/domain/plot/Scaffold";
import { parseOutline } from "../../../src/domain/plot/Outline";

const outline = parseOutline(`# Act I
## The perfect record
### 1 Gainesville courtroom
<!-- Kevin wins a case he knows he should lose -->
### 4 The recess bathroom
## The offer
### 12 The New York invitation
# Act II
## The firm: Milton/Chadwick
### 21 Milton Chadwick and Waters
`);
const none = () => null;

describe("planScaffold", () => {
  it("one note per chapter, in act folders, with story-order and the loglines as comments; every stop relinked", () => {
    const plan = planScaffold(outline, { folder: "DA/", shape: "chapters", outlineName: "Outline", existing: none });
    expect(plan.folders).toEqual(["DA/Act I", "DA/Act II"]);
    expect(plan.files.map((f) => f.path)).toEqual(["DA/Act I/The perfect record.md", "DA/Act I/The offer.md", "DA/Act II/The firm- Milton-Chadwick.md"]);
    expect(plan.files[0]!.content).toBe("---\nstory-order: 1\n---\n## 1 Gainesville courtroom\n<!-- Kevin wins a case he knows he should lose -->\n\n## 4 The recess bathroom\n");
    expect(plan.files[2]!.content).toBe("---\nstory-order: 3\n---\n## 21 Milton Chadwick and Waters\n");
    expect(plan.relinks).toEqual([
      { from: "Outline#1 Gainesville courtroom", to: "The perfect record#1 Gainesville courtroom" },
      { from: "Outline#4 The recess bathroom", to: "The perfect record#4 The recess bathroom" },
      { from: "Outline#12 The New York invitation", to: "The offer#12 The New York invitation" },
      { from: "Outline#21 Milton Chadwick and Waters", to: "The firm- Milton-Chadwick#21 Milton Chadwick and Waters" },
    ]);
    expect([plan.scenes, plan.created, plan.skipped]).toEqual([4, 3, []]);
    expect(scaffoldPaths(outline, "DA/", "chapters")).toEqual(plan.files.map((f) => f.path));
  });

  it("one note for the whole story folds acts and chapters away", () => {
    const plan = planScaffold(outline, { folder: "DA/", shape: "one-note", outlineName: "Outline", existing: none });
    expect(plan.folders).toEqual([]);
    expect(plan.files.map((f) => f.path)).toEqual(["DA/Draft.md"]);
    expect(plan.files[0]!.content.split("\n").filter((l) => l.startsWith("## "))).toHaveLength(4);
    expect(plan.relinks[3]).toEqual({ from: "Outline#21 Milton Chadwick and Waters", to: "Draft#21 Milton Chadwick and Waters" });
  });

  it("appends only the headings a note lacks, never touching what is there, and skips a note that has them all", () => {
    const have: Record<string, string> = {
      "DA/Act I/The perfect record.md": "---\nstory-order: 1\n---\n## 1 Gainesville courtroom\nKevin stands. The room is hot.\n",
      "DA/Act I/The offer.md": "## 12 The New York invitation\n",
    };
    const plan = planScaffold(outline, { folder: "DA/", shape: "chapters", outlineName: "Outline", existing: (p) => have[p] ?? null });
    expect(plan.files.map((f) => [f.path, f.headings])).toEqual([["DA/Act I/The perfect record.md", ["4 The recess bathroom"]], ["DA/Act II/The firm- Milton-Chadwick.md", ["21 Milton Chadwick and Waters"]]]);
    expect(plan.files[0]!.content).toBe("---\nstory-order: 1\n---\n## 1 Gainesville courtroom\nKevin stands. The room is hot.\n\n## 4 The recess bathroom\n");
    expect(plan.skipped).toEqual(["1 Gainesville courtroom", "12 The New York invitation"]);
    expect([plan.scenes, plan.created]).toEqual([2, 1]);
    // Relinks still cover every scene: a stop on a skipped one follows it too.
    expect(plan.relinks).toHaveLength(4);
  });

  it("chapters with no act sit in the project folder, unnamed chapters are numbered, and names are made safe", () => {
    const loose = parseOutline("## One\n### A\n## \n### B\n");
    const plan = planScaffold(parseOutline("### Alone\n"), { folder: "", shape: "chapters", outlineName: "Outline", existing: none });
    expect(plan.files.map((f) => f.path)).toEqual(["Chapter 1.md"]);
    expect(planScaffold(loose, { folder: "P/", shape: "chapters", outlineName: "Outline", existing: none }).files.map((f) => f.path)).toEqual(["P/One.md", "P/Chapter 2.md"]);
    expect(safeName('What: "the end"?', "x")).toBe("What- -the end--");
    expect(safeName("   ", "Chapter 3")).toBe("Chapter 3");
  });

  it("describes the plan as a small tree", () => {
    const plan = planScaffold(outline, { folder: "DA/", shape: "chapters", outlineName: "Outline", existing: (p) => (p === "DA/Act I/The offer.md" ? "## Old\n" : null) });
    expect(describeScaffold(plan, "DA/")).toEqual([
      "Act I/",
      "  The perfect record.md  story-order 1",
      "    ## 1 Gainesville courtroom",
      "    ## 4 The recess bathroom",
      "  The offer.md  exists, headings appended",
      "    ## 12 The New York invitation",
      "Act II/",
      "  The firm- Milton-Chadwick.md  story-order 3",
      "    ## 21 Milton Chadwick and Waters",
    ]);
  });
});
