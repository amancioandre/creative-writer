import { describe, it, expect } from "vitest";
import { PromoteIdea, premiseOf, safeName, withProjectKeys } from "../../src/application/use-cases/PromoteIdea";
import type { WriterVault } from "../../src/application/ports/WriterVault";
import type { Card } from "../../src/domain/writer/Board";

function fakeVault(initial: Record<string, string> = {}, fm: Record<string, Record<string, unknown>> = {}) {
  const files = { ...initial };
  const folders = new Set<string>();
  const frontmatter = { ...fm };
  const vault: WriterVault = {
    paths: () => Object.keys(files),
    frontmatter: (p) => frontmatter[p] ?? null,
    resolve: (link) => Object.keys(files).find((p) => p.endsWith(`/${link}.md`) || p === `${link}.md`) ?? null,
    exists: async (p) => p in files || folders.has(p),
    read: async (p) => files[p] ?? "",
    write: async (p, t) => { files[p] = t; },
    createFolder: async (p) => { folders.add(p); },
    processFrontMatter: async (p, change) => { const f = frontmatter[p] ?? {}; change(f); frontmatter[p] = f; },
    folderHasProse: async () => false,
  };
  return { vault, files, folders, frontmatter };
}

const idea: Card = { path: "notes/Bear hunt premise.md", title: "Bear hunt premise", story: null, reading: null, groups: ["premise"], tagGroups: ["premise"], excerpt: "A man hunts a bear to find himself. He fails first.", position: null };

describe("PromoteIdea", () => {
  it("scaffolds the documented shape, writes the project note keys and links the idea back", async () => {
    const { vault, files, folders, frontmatter } = fakeVault({ [idea.path]: "" });
    const path = await new PromoteIdea(vault).execute({ idea, name: "The Bear Hunt", folder: "/storytelling/" });
    expect(path).toBe("storytelling/The Bear Hunt/The Bear Hunt.md");
    expect([...folders]).toEqual(["storytelling/The Bear Hunt/Characters", "storytelling/The Bear Hunt/Places", "storytelling/The Bear Hunt/Items", "storytelling/The Bear Hunt/Act I", "storytelling/The Bear Hunt/Act II", "storytelling/The Bear Hunt/Act III", "storytelling/The Bear Hunt/_Work"]);
    expect(files[path]).toBe('---\nstory: true\nwriting-stage: development\nwriting-premise: "A man hunts a bear to find himself."\nwriting-idea: "[[Bear hunt premise]]"\n---\n');
    expect(frontmatter[idea.path]).toEqual({ "writer-story": "[[The Bear Hunt]]" });
  });
  it("starts a story from nothing at the vault root, and refuses a name that is taken or empty", async () => {
    const { vault, files } = fakeVault({ "Taken/Taken.md": "" });
    const path = await new PromoteIdea(vault).execute({ idea: null, name: " New: Story? ", folder: "" });
    expect(path).toBe("New Story/New Story.md");
    expect(files[path]).toContain('writing-premise: ""');
    expect(files[path]).not.toContain("writing-idea");
    await expect(new PromoteIdea(vault).execute({ idea: null, name: "Taken", folder: "" })).rejects.toThrow("already exists");
    await expect(new PromoteIdea(vault).execute({ idea: null, name: "///", folder: "" })).rejects.toThrow("needs a name");
  });
  it("copies a template folder with {{name}} replaced, turning its marked note into the project note", async () => {
    const { vault, files, folders } = fakeVault(
      { "Templates/Story/{{name}}.md": "---\nstory-template: true\ntags: [draft]\n---\n# {{name}}\n", "Templates/Story/Characters/Hero.md": "The hero of {{name}}.", "Templates/Other.md": "not copied" },
      { "Templates/Story/{{name}}.md": { "story-template": true } },
    );
    const path = await new PromoteIdea(vault).execute({ idea, name: "Horse", folder: "storytelling" });
    expect(path).toBe("storytelling/Horse/Horse.md");
    expect(files[path]).toBe('---\ntags: [draft]\nstory: true\nwriting-stage: development\nwriting-premise: "A man hunts a bear to find himself."\nwriting-idea: "[[Bear hunt premise]]"\n---\n# Horse\n');
    expect(files["storytelling/Horse/Characters/Hero.md"]).toBe("The hero of Horse.");
    expect(files["storytelling/Horse/Other.md"]).toBeUndefined();
    expect(folders.size).toBe(0);
  });
  it("declares an unfiled folder on its namesake note, its first note, or a new note", async () => {
    const a = fakeVault({ "storytelling/Loose/Loose.md": "", "storytelling/Loose/A.md": "" });
    expect(await new PromoteIdea(a.vault).declare("storytelling/Loose/")).toBe("storytelling/Loose/Loose.md");
    expect(a.frontmatter["storytelling/Loose/Loose.md"]).toEqual({ story: true });
    const b = fakeVault({ "storytelling/Loose/B.md": "", "storytelling/Loose/A.md": "" });
    expect(await new PromoteIdea(b.vault).declare("storytelling/Loose")).toBe("storytelling/Loose/A.md");
    const c = fakeVault({});
    expect(await new PromoteIdea(c.vault).declare("storytelling/Loose")).toBe("storytelling/Loose/Loose.md");
    expect(c.files["storytelling/Loose/Loose.md"]).toBe("");
    expect(c.frontmatter["storytelling/Loose/Loose.md"]).toEqual({ story: true });
  });
  it("helpers: the premise is the first sentence, names are made safe, keys go into an existing block", () => {
    expect(premiseOf(idea)).toBe("A man hunts a bear to find himself.");
    expect(premiseOf({ ...idea, excerpt: "No punctuation here" })).toBe("No punctuation here");
    expect(premiseOf(null)).toBe("");
    expect(safeName(' A/B: "C" ')).toBe("A B C");
    expect(withProjectKeys("body", [["story", "true"]])).toBe("---\nstory: true\n---\nbody");
    expect(withProjectKeys("---\nstory-template: true\nstory: false\nx: 1\n---\nbody", [["story", "true"]])).toBe("---\nx: 1\nstory: true\n---\nbody");
  });
});
