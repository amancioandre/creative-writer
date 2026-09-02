import { describe, it, expect } from "vitest";
import { VaultWriterNotes, type WriterAppLike, excerptOf, tagsOf } from "../../../src/infrastructure/obsidian/VaultWriterNotes";

const files: Record<string, { fm?: Record<string, unknown>; tags?: string[]; links?: string[]; body: string }> = {
  "sources/poems/Invictus.md": { tags: ["#writer/poem"], body: "# Invictus\n\nOut of the night that covers me,\nBlack as the pit.\n\nSecond." },
  "notes/Courage.md": { fm: { tags: ["writer/theme", "personal"] }, links: ["Invictus", "Missing", "Courage"], body: "---\ntags: [writer/theme]\n---\n%% private %%\nCourage is what is left.\n" },
  "notes/Seven words.md": { fm: { tag: "writer/note writer/sentiment" }, body: "" },
  "journal/Today.md": { tags: ["#daily"], body: "Nothing." },
};

const app: WriterAppLike = {
  vault: {
    getMarkdownFiles: () => Object.keys(files).map((path) => ({ path })),
    cachedRead: async (f) => files[f.path]!.body,
  },
  metadataCache: {
    getFileCache: (f) => ({ frontmatter: files[f.path]!.fm, tags: (files[f.path]!.tags ?? []).map((tag) => ({ tag })), links: (files[f.path]!.links ?? []).map((link) => ({ link })) }),
    getFirstLinkpathDest: (link) => {
      const hit = Object.keys(files).find((p) => p.endsWith(`/${link}.md`));
      return hit ? { path: hit } : null;
    },
  },
};

describe("VaultWriterNotes", () => {
  it("reads only the notes tagged under the prefix, from inline tags and both front matter keys, with resolved links and an excerpt", async () => {
    const notes = await new VaultWriterNotes(app).notes("writer");
    expect(notes.map((n) => n.path)).toEqual(["sources/poems/Invictus.md", "notes/Courage.md", "notes/Seven words.md"]);
    const courage = notes.find((n) => n.path === "notes/Courage.md")!;
    expect(courage.title).toBe("Courage");
    expect(courage.tags).toEqual(["writer/theme", "personal"]);
    expect(courage.links).toEqual(["sources/poems/Invictus.md"]);
    expect(courage.excerpt).toBe("Courage is what is left.");
    expect(notes.find((n) => n.path === "notes/Seven words.md")!.tags).toEqual(["writer/note", "writer/sentiment"]);
    expect(notes.find((n) => n.path === "sources/poems/Invictus.md")!.excerpt).toBe("Out of the night that covers me, Black as the pit.");
  });
  it("prefers the live editor text and honours another prefix", async () => {
    const live = new VaultWriterNotes(app, (path) => (path === "notes/Courage.md" ? "Typed just now." : null));
    expect((await live.notes("writer")).find((n) => n.path === "notes/Courage.md")!.excerpt).toBe("Typed just now.");
    expect(await new VaultWriterNotes(app).notes("me")).toEqual([]);
  });
  it("lists tags from a cache and cuts a long excerpt", () => {
    expect(tagsOf(null)).toEqual([]);
    expect(tagsOf({ frontmatter: { tags: "a, b" }, tags: [{ tag: "#c" }] })).toEqual(["#c", "a", "b"]);
    const long = excerptOf("x".repeat(400));
    expect(long.length).toBe(280);
    expect(long.endsWith("…")).toBe(true);
    expect(excerptOf("---\na: 1\n---\n\n## Heading\n\n---\n")).toBe("");
  });
});
