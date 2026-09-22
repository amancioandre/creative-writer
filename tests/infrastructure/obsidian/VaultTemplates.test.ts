import { describe, it, expect } from "vitest";
import { VaultTemplates } from "../../../src/infrastructure/obsidian/VaultTemplates";
import type { VaultAppLike } from "../../../src/infrastructure/obsidian/VaultProjectNotes";

describe("VaultTemplates", () => {
  it("lists the flagged notes in the folder by name, cache or no cache, and saves without overwriting", async () => {
    const files: Record<string, string> = {
      "Creative Writer/Templates/Noir.md": "---\ncreative-writer-template: 1\nwriting-name: Noir in five moves\n---\n## Theme: Fate\n",
      "Creative Writer/Templates/Fresh.md": "---\ncreative-writer-template: 1\n---\n## Arc: [[X]]\n",
      "Creative Writer/Templates/Notes.md": "Just a note in the folder.",
      "Elsewhere/Template.md": "---\ncreative-writer-template: 1\n---\n## Not listed\n",
    };
    const written: string[] = [];
    const app: VaultAppLike = {
      vault: { getMarkdownFiles: () => Object.keys(files).map((path) => ({ path })), cachedRead: async (f) => files[f.path]! },
      metadataCache: { getFileCache: (f) => (f.path.endsWith("Noir.md") ? { frontmatter: { "creative-writer-template": 1, "writing-name": "Noir in five moves" } } : null), getFirstLinkpathDest: () => null },
    };
    const io = { exists: async (p: string) => p in files, read: async (p: string) => files[p]!, write: async (p: string, d: string) => { files[p] = d; written.push(p); } };
    const repo = new VaultTemplates(app, io, () => "/Creative Writer/Templates/");
    expect(repo.folder()).toBe("Creative Writer/Templates");
    expect((await repo.list()).map((t) => [t.name, t.path])).toEqual([["Fresh", "Creative Writer/Templates/Fresh.md"], ["Noir in five moves", "Creative Writer/Templates/Noir.md"]]);
    expect(await repo.save("Noir", "x")).toBe("Creative Writer/Templates/Noir 2.md");
    expect(await repo.save("Brand new", "y")).toBe("Creative Writer/Templates/Brand new.md");
    expect(written).toEqual(["Creative Writer/Templates/Noir 2.md", "Creative Writer/Templates/Brand new.md"]);
  });
});
