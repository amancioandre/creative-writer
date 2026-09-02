import { describe, it, expect } from "vitest";
import { VaultProjectNotes, type VaultAppLike } from "../../../src/infrastructure/obsidian/VaultProjectNotes";

const files: Record<string, { fm?: Record<string, unknown>; links?: string[]; body: string }> = {
  "Novel/Novel.md": { fm: { "writing-target": 1000 }, body: "# Plan" },
  "Novel/Characters/Marta.md": { fm: { type: "character" }, links: ["Ilse"], body: "Elder.\n\n## Relationships\n- [[Ilse]] — sister\n- [[Nobody]] — ?\n" },
  "Novel/Characters/Ilse.md": { body: "" },
  "Novel/One.md": { links: ["Marta#Childhood", "Missing", "One"], body: "# Camp\nMarta and Ilse.\n" },
  "Novel/Story map.md": { fm: { "creative-writer-storymap": 1 }, body: "```json\n{}\n```" },
  "Novel/memos/review.md": { fm: { "creative-writer": false }, body: "He said This. Analysis." },
  "Other/Note.md": { body: "Not in scope." },
};

const app: VaultAppLike = {
  vault: {
    getMarkdownFiles: () => Object.keys(files).map((path) => ({ path })),
    cachedRead: async (f) => files[f.path]!.body,
  },
  metadataCache: {
    getFileCache: (f) => ({ frontmatter: files[f.path]!.fm, links: (files[f.path]!.links ?? []).map((link) => ({ link })) }),
    getFirstLinkpathDest: (link) => {
      const hit = Object.keys(files).find((p) => p.endsWith(`/${link}.md`));
      return hit ? { path: hit } : null;
    },
  },
  internalPlugins: {
    getPluginById: () => ({ enabled: true, instance: { items: [{ type: "file", path: "Novel/Characters/Ilse.md" }, { type: "group", items: [{ type: "heading", path: "Novel/One.md", subpath: "#Camp" }] }, { type: "search" }] } }),
  },
};

describe("VaultProjectNotes", () => {
  const source = new VaultProjectNotes(app);
  it("lists projects from front matter", () => {
    expect(source.projects().map((p) => [p.name, p.scope])).toEqual([["Novel", "Novel/"]]);
  });
  it("reads in-scope notes with resolved links, bookmarks and scenes, skipping the story map note and opted-out notes", async () => {
    const notes = await source.notes(source.projects()[0]!);
    expect(notes.map((n) => n.path)).toEqual(["Novel/Novel.md", "Novel/Characters/Marta.md", "Novel/Characters/Ilse.md", "Novel/One.md"]);
    const one = notes.find((n) => n.path === "Novel/One.md")!;
    expect(one.links).toEqual(["Novel/Characters/Marta.md"]);
    expect(one.text).toBe("# Camp\nMarta and Ilse.\n");
    expect(one.bookmarkedHeadings).toEqual(["Camp"]);
    expect(one.scenes[0]!.title).toBe("Camp");
    expect(notes.find((n) => n.path === "Novel/Characters/Ilse.md")!.bookmarked).toBe(true);
    expect(notes.find((n) => n.path === "Novel/Characters/Marta.md")!.frontmatter).toEqual({ type: "character" });
  });
  it("reads hand-written relationships and resolves their links where it can", async () => {
    const notes = await source.notes(source.projects()[0]!);
    expect(notes.find((n) => n.path === "Novel/Characters/Marta.md")!.relations).toEqual([
      { target: "Ilse", targetPath: "Novel/Characters/Ilse.md", label: "sister", line: 3 },
      { target: "Nobody", targetPath: null, label: "?", line: 4 },
    ]);
    expect(notes.find((n) => n.path === "Novel/One.md")!.relations).toEqual([]);
  });
  it("reads through the host's scope rule when given one", async () => {
    const scoped = new VaultProjectNotes(app, (path) => path.startsWith("Novel/Characters/"));
    const notes = await scoped.notes(source.projects()[0]!);
    expect(notes.map((n) => n.path)).toEqual(["Novel/Characters/Marta.md", "Novel/Characters/Ilse.md"]);
  });
  it("copes without a bookmarks plugin", async () => {
    const notes = await new VaultProjectNotes({ ...app, internalPlugins: undefined }).notes(source.projects()[0]!);
    expect(notes.every((n) => !n.bookmarked)).toBe(true);
  });
});

describe("VaultProjectNotes live text", () => {
  it("prefers the text of an open editor over the disk", async () => {
    const source = new VaultProjectNotes(app, undefined, (path) => (path === "Novel/One.md" ? "# Camp\nUnsaved." : null));
    const notes = await source.notes(source.projects()[0]!);
    expect(notes.find((n) => n.path === "Novel/One.md")!.text).toBe("# Camp\nUnsaved.");
    expect(notes.find((n) => n.path === "Novel/Novel.md")!.text).toBe("# Plan");
  });
});
