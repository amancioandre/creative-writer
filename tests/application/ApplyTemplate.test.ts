import { describe, it, expect } from "vitest";
import { ApplyTemplate } from "../../src/application/use-cases/ApplyTemplate";
import { OutlineNoteRepository } from "../../src/infrastructure/obsidian/OutlineNoteRepository";
import { StoryThreadsNoteRepository } from "../../src/infrastructure/obsidian/StoryThreadsNoteRepository";
import { BUILT_IN_TEMPLATES } from "../../src/domain/plot/BuiltInTemplates";
import { parseOutline } from "../../src/domain/plot/Outline";
import { parseTemplate } from "../../src/domain/plot/Templates";
import type { ProjectSpec } from "../../src/domain/progress/Project";

function fakeVault(files: Record<string, string> = {}) {
  return { files, async exists(p: string) { return p in files; }, async read(p: string) { return files[p]!; }, async write(p: string, d: string) { files[p] = d; } };
}
const project: ProjectSpec = { name: "DA", scope: "DA/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "DA/Analysis.md", ignoredNames: [] };
const cast = [{ name: "Kevin Lomax", kind: "character", path: "DA/Characters/Kevin Lomax.md" }];

function make(files: Record<string, string>, own: { name: string; path: string; markdown: string }[] = []) {
  const vault = fakeVault(files);
  const keys: string[] = [];
  const saved: { name: string; markdown: string }[] = [];
  const templates = { folder: () => "Creative Writer/Templates", list: async () => own, save: async (name: string, markdown: string) => { saved.push({ name, markdown }); return `Creative Writer/Templates/${name}.md`; } };
  const use = new ApplyTemplate(templates, new StoryThreadsNoteRepository(vault), new OutlineNoteRepository(vault), { set: async (_p, key, value) => { keys.push(`${key}=${value ?? ""}`); } });
  return { vault, use, keys, saved };
}

describe("ApplyTemplate", () => {
  it("lists built-ins then the writer's own, plans against what the threads note has, and applies headings, rows and jobs with an exact undo", async () => {
    const { vault, use, keys } = make({ "DA/Story threads.md": "## Theme: Main theme\n" }, [{ name: "My arcs", path: "Creative Writer/Templates/My arcs.md", markdown: "---\ncreative-writer-template: 1\n---\n## Arc: [[Kevin Lomax]]\n" }]);
    const list = await use.list();
    expect(list.map((t) => t.name)).toEqual([...BUILT_IN_TEMPLATES.map((t) => t.name), "My arcs"]);
    const saveTheCat = list.find((t) => t.name === "Save the Cat")!;
    const plan = await use.plan(project, saveTheCat, { rows: true, columns: true }, cast);
    expect(plan.headings).toEqual(["Plot point", "Subplot: B story"]);
    expect(plan.skipped).toEqual(["Theme: Main theme"]);
    expect(plan.jobs).toEqual({ theme: "Theme: Main theme", beats: "Plot point" });
    const result = await use.execute({ ...project, plotTheme: "Theme: Old" }, plan);
    expect(result.added).toEqual(["Plot point", "Subplot: B story"]);
    expect(result.beatStops).toBe(15);
    const threads = vault.files["DA/Story threads.md"]!;
    expect(threads.startsWith("## Theme: Main theme\n\n## Plot point\n- [[Outline#Opening image]] — Opening image\n")).toBe(true);
    expect(threads).toContain("- [[Outline#Dark night of the soul]] — Dark night of the soul\n");
    expect(threads.endsWith("\n## Subplot: B story\n")).toBe(true);
    expect(parseOutline(vault.files["DA/Outline.md"]!).scenes).toBe(15);
    expect(vault.files["DA/Outline.md"]!.startsWith("---\ncreative-writer: false\ncreative-writer-outline: 1\n---")).toBe(true);
    expect(keys).toEqual(["plot-theme=Theme: Main theme", "plot-beats=Plot point"]);
    await result.undo();
    expect(vault.files["DA/Story threads.md"]).toBe("## Theme: Main theme\n");
    expect(vault.files["DA/Outline.md"]).toBe("");
    expect(keys.slice(-2)).toEqual(["plot-theme=Theme: Old", "plot-beats="]);
  });

  it("saves the grid as a template note with the jobs, and refuses an empty one", async () => {
    const { use, saved } = make({ "DA/Story threads.md": "## Arc: [[Kevin Lomax]]\n- [[Outline#1 Court]] — a stop\n\n## Theme: Vanity\n", "DA/Outline.md": "---\ncreative-writer-outline: 1\n---\nThe outline.\n\n# Act I\n### 1 Court\n<!-- Kevin wins -->\n" });
    const path = await use.save({ ...project, plotTheme: "Theme: Vanity" }, "Noir", { columns: true, rows: true });
    expect(path).toBe("Creative Writer/Templates/Noir.md");
    const back = parseTemplate(saved[0]!.markdown, "Noir", path);
    expect(back.columns.map((c) => c.heading)).toEqual(["Arc: [[Kevin Lomax]]", "Theme: Vanity"]);
    expect(back.jobs).toEqual({ theme: "Theme: Vanity" });
    expect(back.outline.acts[0]!.chapters[0]!.scenes[0]).toMatchObject({ title: "1 Court", logline: "Kevin wins" });
    expect(saved[0]!.markdown).not.toContain("a stop");
    await expect(make({}).use.save(project, "Empty", { columns: true, rows: true })).rejects.toThrow("nothing to save");
  });
});
