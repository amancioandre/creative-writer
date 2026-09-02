import { describe, it, expect } from "vitest";
import { VaultWriterFiles, type FilesAppLike } from "../../../src/infrastructure/obsidian/VaultWriterFiles";

describe("VaultWriterFiles", () => {
  const files: Record<string, string> = { "a/One.md": "# H\nProse here.\n", "b/Two.md": "# Only\n", "c.md": "" };
  const folders = new Set<string>(["a", "b"]);
  const created: string[] = [];
  const app: FilesAppLike = {
    vault: {
      getMarkdownFiles: () => Object.keys(files).map((path) => ({ path })),
      getAbstractFileByPath: (p) => (p in files ? { path: p } : folders.has(p) ? { path: p, children: [] } : null),
      createFolder: async (p) => { if (folders.has(p)) throw new Error("Folder already exists."); folders.add(p); created.push(p); },
    },
    metadataCache: {
      getFileCache: (f) => (f.path === "a/One.md" ? { frontmatter: { story: true } } : null),
      getFirstLinkpathDest: (link) => (link === "One" ? { path: "a/One.md" } : null),
    },
  };
  const io = { exists: async (p: string) => p in files, read: async (p: string) => files[p] ?? "", write: async (p: string, t: string) => { files[p] = t; } };
  const fm: string[] = [];
  const v = new VaultWriterFiles(app, io, async (p) => { fm.push(p); });

  it("answers paths, front matter, links and existence from the app", async () => {
    expect(v.paths()).toEqual(["a/One.md", "b/Two.md", "c.md"]);
    expect(v.frontmatter("a/One.md")).toEqual({ story: true });
    expect(v.frontmatter("c.md")).toBeNull();
    expect(v.resolve("One", "x.md")).toBe("a/One.md");
    expect(v.resolve("Nope", "x.md")).toBeNull();
    expect(await v.exists("a")).toBe(true);
    expect(await v.exists("zzz")).toBe(false);
  });
  it("reads, writes and edits front matter through the shared IO", async () => {
    await v.write("d/New.md", "x");
    expect(await v.read("d/New.md")).toBe("x");
    await v.processFrontMatter("c.md", () => undefined);
    expect(fm).toEqual(["c.md"]);
  });
  it("creates missing folders along a path and tolerates ones that exist", async () => {
    await v.createFolder("a/deep/er");
    expect(created).toEqual(["a/deep", "a/deep/er"]);
  });
  it("knows whether a folder holds prose", async () => {
    expect(await v.folderHasProse("a")).toBe(true);
    expect(await v.folderHasProse("b")).toBe(false);
  });
});
