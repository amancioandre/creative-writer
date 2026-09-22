import { describe, it, expect } from "vitest";
import { ScaffoldManuscript, type ScaffoldVault } from "../../src/application/use-cases/ScaffoldManuscript";
import { OutlineNoteRepository } from "../../src/infrastructure/obsidian/OutlineNoteRepository";
import { StoryThreadsNoteRepository } from "../../src/infrastructure/obsidian/StoryThreadsNoteRepository";
import { parseOutline } from "../../src/domain/plot/Outline";
import type { ProjectSpec } from "../../src/domain/progress/Project";

function fakeVault(files: Record<string, string> = {}) {
  const folders = new Set<string>();
  const vault: ScaffoldVault & { files: Record<string, string>; folders: Set<string> } = {
    files, folders,
    exists: async (p) => p in files,
    read: async (p) => files[p]!,
    write: async (p, c) => { files[p] = c; const parts = p.split("/").slice(0, -1); for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join("/")); },
    remove: async (p) => { delete files[p]; },
    removeFolderIfEmpty: async (p) => { if (!folders.has(p) || Object.keys(files).some((f) => f.startsWith(`${p}/`))) return false; folders.delete(p); return true; },
  };
  return vault;
}
const project: ProjectSpec = { name: "DA", scope: "DA/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "DA/Analysis.md", ignoredNames: [] };
const outline = `---\ncreative-writer: false\ncreative-writer-outline: 1\n---\n# Act I\n## The perfect record\n### 1 Gainesville courtroom\n<!-- Kevin wins -->\n### 4 The recess bathroom\n## The offer\n### 12 The New York invitation\n`;
const threads = `## Subplot: The Cullen trial\n- [[Outline#1 Gainesville courtroom]] — plant: the file lands\n- [[Outline#12 The New York invitation]] — the offer\n\n## Arc: [[Kevin]]\n- [[Outline#4 The recess bathroom]] — want: to win\n`;

function make(files: Record<string, string>) {
  const vault = fakeVault(files);
  const use = new ScaffoldManuscript(new OutlineNoteRepository(vault), new StoryThreadsNoteRepository(vault), vault, () => "2026-09-22");
  return { vault, use };
}

describe("ScaffoldManuscript", () => {
  it("previews without touching anything, and there is nothing to build without an outline", async () => {
    const { vault, use } = make({ "DA/Outline.md": outline, "DA/Story threads.md": threads });
    const plan = await use.preview(project, "chapters");
    expect(plan?.files.map((f) => f.path)).toEqual(["DA/Act I/The perfect record.md", "DA/Act I/The offer.md"]);
    expect(Object.keys(vault.files)).toEqual(["DA/Outline.md", "DA/Story threads.md"]);
    expect(await make({}).use.preview(project, "chapters")).toBeNull();
    await expect(make({}).use.execute(project, "chapters")).rejects.toThrow("no outline");
  });

  it("writes the notes, relinks every stop, marks the outline built, and undoes all of it", async () => {
    const { vault, use } = make({ "DA/Outline.md": outline, "DA/Story threads.md": threads });
    const result = await use.execute(project, "chapters");
    expect(vault.files["DA/Act I/The perfect record.md"]).toBe("---\nstory-order: 1\n---\n## 1 Gainesville courtroom\n<!-- Kevin wins -->\n\n## 4 The recess bathroom\n");
    expect(vault.files["DA/Story threads.md"]).toBe(`## Subplot: The Cullen trial\n- [[The perfect record#1 Gainesville courtroom]] — plant: the file lands\n- [[The offer#12 The New York invitation]] — the offer\n\n## Arc: [[Kevin]]\n- [[The perfect record#4 The recess bathroom]] — want: to win\n`);
    expect(parseOutline(vault.files["DA/Outline.md"]!).built).toBe("2026-09-22");
    expect([result.relinked, result.plan.created, result.plan.scenes, result.day]).toEqual([3, 2, 3, "2026-09-22"]);
    await result.undo();
    expect(Object.keys(vault.files).sort()).toEqual(["DA/Outline.md", "DA/Story threads.md"]);
    expect(vault.files["DA/Outline.md"]).toBe(outline);
    expect(vault.files["DA/Story threads.md"]).toBe(threads);
    expect(vault.folders.has("DA/Act I")).toBe(false);
  });

  it("a rerun appends only what a note lacks, and undo keeps a note the writer has touched since", async () => {
    const { vault, use } = make({ "DA/Outline.md": outline, "DA/Act I/The perfect record.md": "## 1 Gainesville courtroom\nKevin stands.\n" });
    const first = await use.execute(project, "chapters");
    expect(vault.files["DA/Act I/The perfect record.md"]).toBe("## 1 Gainesville courtroom\nKevin stands.\n\n## 4 The recess bathroom\n");
    expect(first.plan.skipped).toEqual(["1 Gainesville courtroom"]);
    const again = await use.execute(project, "chapters");
    expect(again.plan.files).toEqual([]);
    expect(again.plan.skipped).toHaveLength(3);
    // The writer drafts into the built note; undo of the first build leaves it alone, and only removes what is still exactly as written.
    vault.files["DA/Act I/The offer.md"] += "The city at night.\n";
    await first.undo();
    expect(vault.files["DA/Act I/The offer.md"]).toContain("The city at night.");
    expect(vault.files["DA/Act I/The perfect record.md"]).toBe("## 1 Gainesville courtroom\nKevin stands.\n");
    expect(vault.folders.has("DA/Act I")).toBe(true);
    expect(parseOutline(vault.files["DA/Outline.md"]!).built).toBeNull();
  });
});
