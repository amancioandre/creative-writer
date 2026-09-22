import { describe, it, expect } from "vitest";
import { parseTemplate, planApply, serializeTemplate, templateFileName } from "../../../src/domain/plot/Templates";
import { BUILT_IN_TEMPLATES } from "../../../src/domain/plot/BuiltInTemplates";
import { appendOutline, parseOutline } from "../../../src/domain/plot/Outline";
import { planScaffold } from "../../../src/domain/plot/Scaffold";

const byName = (n: string) => BUILT_IN_TEMPLATES.find((t) => t.name === n)!;
const cast = [{ name: "Kevin Lomax", kind: "character", path: "DA/Characters/Kevin Lomax.md" }, { name: "Mary Ann Lomax", kind: "character", path: "DA/Characters/Mary Ann Lomax.md" }, { name: "New York", kind: "location", path: "DA/Places/New York.md" }];

describe("parseTemplate", () => {
  it("reads columns under # Columns and the structure from the rest, with jobs from the front matter and beats under scenes", () => {
    const t = byName("Save the Cat");
    expect(t.columns.map((c) => [c.heading, c.kind, c.placeholder])).toEqual([["Plot point", "free", null], ["Theme: Main theme", "theme", null], ["Subplot: B story", "subplot", null]]);
    expect(t.jobs).toEqual({ theme: "Theme: Main theme", beats: "Plot point" });
    expect(t.outline.acts.map((a) => [a.title, a.chapters[0]!.scenes.length])).toEqual([["Act I", 6], ["Act II", 7], ["Act III", 2]]);
    expect(t.outline.scenes).toBe(15);
    expect(t.outline.acts[0]!.chapters[0]!.scenes[3]).toMatchObject({ title: "Catalyst", logline: "The event that ends the old life", beats: ["Catalyst"] });
    expect(t.structure.startsWith("# Act I\n### Opening image")).toBe(true);
    expect(t.structure).not.toContain("# Columns");
  });

  it("a note with no act is columns only, in the threads note's own shape; placeholders are recognised", () => {
    const t = byName("Story analysis");
    expect(t.columns.map((c) => c.heading)).toEqual(["Chapter number", "Time", "POV", "Plot point", "Main plot", "Theme: Major theme", "Subplot: Subplot 1", "Subplot: Subplot 2", "Arc: Character A", "Arc: Character B"]);
    expect(t.columns.map((c) => c.placeholder)).toEqual([null, null, null, null, null, null, null, null, "arc", "arc"]);
    expect(t.jobs).toEqual({ time: "Time", pov: "POV", theme: "Theme: Major theme", beats: "Plot point" });
    expect([t.structure, t.outline.scenes]).toEqual(["", 0]);
    expect(byName("An arc per character").columns[0]!.placeholder).toBe("every-character");
  });

  it("every built-in parses, with a name and either columns or rows", () => {
    for (const t of BUILT_IN_TEMPLATES) { expect(t.name).toBeTruthy(); expect(t.columns.length + t.outline.scenes).toBeGreaterThan(0); expect(t.path).toBeNull(); }
    expect(byName("Hero's journey").outline.scenes).toBe(12);
    expect(byName("Three acts").outline.scenes).toBe(9);
  });
});

describe("planApply", () => {
  it("binds arc placeholders to the cast, renames themes and subplots, sets the jobs on the written headings, and skips what exists", () => {
    const plan = planApply(byName("Story analysis"), { rows: false, columns: true, bindings: { "Arc: Character A": "Kevin Lomax", "Arc: Character B": "Mary Ann Lomax" }, names: { "Subplot: Subplot 1": "The Cullen trial", "Theme: Major theme": "Vanity" } }, { existing: ["Arc: [[Kevin Lomax]]", "Subplot: The Cullen trial"], cast });
    expect(plan.headings).toEqual(["Chapter number", "Time", "POV", "Plot point", "Main plot", "Theme: Vanity", "Subplot: Subplot 2", "Arc: [[Mary Ann Lomax]]"]);
    expect(plan.skipped).toEqual(["Subplot: The Cullen trial", "Arc: [[Kevin Lomax]]"]);
    expect(plan.jobs).toEqual({ time: "Time", pov: "POV", theme: "Theme: Vanity", beats: "Plot point" });
    expect([plan.structure, plan.scenes]).toEqual([null, 0]);
  });

  it("expands one arc per character, honours the ticks, and leaves an unbound placeholder as written", () => {
    const plan = planApply(byName("An arc per character"), { rows: true, columns: true, ticked: new Set(["Arc: every character"]) }, { existing: [], cast });
    expect(plan.headings).toEqual(["Arc: [[Kevin Lomax]]", "Arc: [[Mary Ann Lomax]]"]);
    expect(plan.jobs).toEqual({});
    const unbound = planApply(byName("Story analysis"), { rows: false, columns: true, ticked: new Set(["Arc: Character A"]) }, { existing: [], cast });
    expect(unbound.headings).toEqual(["Arc: Character A"]);
  });

  it("rows only appends the structure to the outline, beats and all, and the build carries the beats into the chapter notes", () => {
    const plan = planApply(byName("Save the Cat"), { rows: true, columns: false }, { existing: [], cast });
    expect([plan.headings, plan.scenes]).toEqual([[], 15]);
    const outline = parseOutline(appendOutline("---\ncreative-writer-outline: 1\n---\n", plan.structure!));
    expect(outline.acts.map((a) => a.title)).toEqual(["Act I", "Act II", "Act III"]);
    expect(outline.acts[1]!.chapters[0]!.scenes.map((s) => s.beats[0])).toContain("Dark night of the soul");
    const built = planScaffold(outline, { folder: "DA/", shape: "chapters", outlineName: "Outline", existing: () => null });
    expect(built.files[0]!.content).toContain("## Opening image\n<!-- A snapshot of the hero before anything changes -->\n<!-- beat: Opening image -->");
  });
});

describe("saving a template", () => {
  it("writes the columns, the jobs and the outline as a template note that reads back the same", () => {
    const md = serializeTemplate("Noir in five moves", { columns: ["Arc: [[Kevin Lomax]]", "Theme: Vanity", "Subplot: The Cullen trial"], jobs: { theme: "Theme: Vanity" }, structure: "# Act I\n## The perfect record\n### 1 Gainesville courtroom\n<!-- Kevin wins -->" });
    expect(md.startsWith("---\ncreative-writer-template: 1\nplot-theme: Theme: Vanity\n---")).toBe(true);
    const back = parseTemplate(md, "Noir in five moves", "Creative Writer/Templates/Noir in five moves.md");
    expect(back.columns.map((c) => c.heading)).toEqual(["Arc: [[Kevin Lomax]]", "Theme: Vanity", "Subplot: The Cullen trial"]);
    expect(back.jobs).toEqual({ theme: "Theme: Vanity" });
    expect(back.outline.acts[0]!.chapters[0]!.scenes[0]).toMatchObject({ title: "1 Gainesville courtroom", logline: "Kevin wins" });
    expect(back.path).toBe("Creative Writer/Templates/Noir in five moves.md");
  });

  it("never overwrites: a taken name gets a number", () => {
    expect(templateFileName("Noir in five moves", ["Noir in five moves", "Other"])).toBe("Noir in five moves 2");
    expect(templateFileName("Noir in five moves", ["noir in five moves", "Noir in five moves 2"])).toBe("Noir in five moves 3");
    expect(templateFileName('What: "the end"?', [])).toBe("What- -the end--");
  });
});
