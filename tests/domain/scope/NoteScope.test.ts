import { describe, it, expect } from "vitest";
import { frontmatterFlag, isNoteActive, isNoteCounted, isPluginDataNote, pathInScope } from "../../../src/domain/scope/NoteScope";

describe("frontmatterFlag", () => {
  it("reads creative-writer: true/false from the front matter block only", () => {
    expect(frontmatterFlag("---\ntitle: x\ncreative-writer: true\n---\nbody")).toBe(true);
    expect(frontmatterFlag("---\ncreative-writer: false\n---\n")).toBe(false);
    expect(frontmatterFlag('---\ncreative-writer: "yes"\n---\n')).toBe(true);
    expect(frontmatterFlag("---\ntitle: x\n---\ncreative-writer: true")).toBeNull();
    expect(frontmatterFlag("no front matter\ncreative-writer: true")).toBeNull();
    expect(frontmatterFlag("---\ncreative-writer: maybe\n---\n")).toBeNull();
  });
});

describe("isNoteActive", () => {
  const all = { mode: "all" as const, folders: [] };
  it("master switch wins over everything", () => {
    expect(isNoteActive({ enabled: false, scope: all, path: "a.md", flag: true })).toBe(false);
  });
  it("front matter wins over scope", () => {
    expect(isNoteActive({ enabled: true, scope: all, path: "a.md", flag: false })).toBe(false);
    expect(isNoteActive({ enabled: true, scope: { mode: "marked", folders: [] }, path: "a.md", flag: true })).toBe(true);
  });
  it("scope modes", () => {
    expect(isNoteActive({ enabled: true, scope: all, path: null, flag: null })).toBe(true);
    expect(isNoteActive({ enabled: true, scope: { mode: "marked", folders: [] }, path: "a.md", flag: null })).toBe(false);
    const folders = { mode: "folders" as const, folders: ["storytelling/novel", "/drafts/"] };
    expect(isNoteActive({ enabled: true, scope: folders, path: "storytelling/novel/ch1.md", flag: null })).toBe(true);
    expect(isNoteActive({ enabled: true, scope: folders, path: "drafts/x.md", flag: null })).toBe(true);
    expect(isNoteActive({ enabled: true, scope: folders, path: "storytelling/novella/ch1.md", flag: null })).toBe(false);
    expect(isNoteActive({ enabled: true, scope: folders, path: null, flag: null })).toBe(false);
  });
});

describe("a declared project is the story", () => {
  const scopes = ["Novel/"];
  it("is in under every mode, and opts out note by note", () => {
    for (const mode of ["all", "marked", "folders", "projects"] as const) {
      expect(isNoteActive({ enabled: true, scope: { mode, folders: [] }, path: "Novel/Characters/Ilse.md", flag: null, projectScopes: scopes })).toBe(true);
      expect(isNoteActive({ enabled: true, scope: { mode, folders: [] }, path: "Novel/memo.md", flag: false, projectScopes: scopes })).toBe(false);
    }
  });
  it("the mode decides what happens outside the projects", () => {
    const outside = (mode: "all" | "marked" | "folders" | "projects", folders: string[] = []) =>
      isNoteActive({ enabled: true, scope: { mode, folders }, path: "Journal/today.md", flag: null, projectScopes: scopes });
    expect(outside("all")).toBe(true);
    expect(outside("marked")).toBe(false);
    expect(outside("projects")).toBe(false);
    expect(outside("folders", ["Journal"])).toBe(true);
    expect(outside("folders", ["Novel"])).toBe(false);
  });
});

describe("projects scope mode", () => {
  const projects = { mode: "projects" as const, folders: ["ignored/"] };
  it("takes in the declared projects' folders and single notes, and nothing else", () => {
    const scopes = ["Novel/", "Shorts/The Well.md"];
    expect(isNoteActive({ enabled: true, scope: projects, path: "Novel/ch1.md", flag: null, projectScopes: scopes })).toBe(true);
    expect(isNoteActive({ enabled: true, scope: projects, path: "Shorts/The Well.md", flag: null, projectScopes: scopes })).toBe(true);
    expect(isNoteActive({ enabled: true, scope: projects, path: "Shorts/Other.md", flag: null, projectScopes: scopes })).toBe(false);
    expect(isNoteActive({ enabled: true, scope: projects, path: "Journal/today.md", flag: null, projectScopes: scopes })).toBe(false);
    expect(isNoteActive({ enabled: true, scope: projects, path: "ignored/x.md", flag: null, projectScopes: scopes })).toBe(false);
    expect(isNoteActive({ enabled: true, scope: projects, path: "Novel/ch1.md", flag: null })).toBe(false);
  });
  it("the vault root as a project takes in everything", () => {
    expect(pathInScope("anything/at/all.md", "")).toBe(true);
  });
});

describe("isNoteCounted", () => {
  const all = { mode: "all" as const, folders: [] };
  it("is the activation rule", () => {
    expect(isNoteCounted({ enabled: true, scope: all, path: "a.md", flag: null })).toBe(true);
    expect(isNoteCounted({ enabled: true, scope: all, path: "a.md", flag: false })).toBe(false);
    expect(isNoteCounted({ enabled: false, scope: all, path: "a.md", flag: null })).toBe(false);
  });
  it("never counts the plugin's own notes, even when the front matter says creative-writer: true", () => {
    for (const flag of ["creative-writer-log", "creative-writer-storymap", "creative-writer-threads"]) {
      expect(isPluginDataNote({ [flag]: 1 })).toBe(true);
      expect(isNoteCounted({ enabled: true, scope: all, path: "Novel/Story map.md", flag: true, frontmatter: { [flag]: true } })).toBe(false);
    }
    expect(isPluginDataNote({ title: "x" })).toBe(false);
    expect(isPluginDataNote(undefined)).toBe(false);
  });
});
