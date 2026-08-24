import { describe, it, expect } from "vitest";
import { frontmatterFlag, isNoteActive } from "../../../src/domain/scope/NoteScope";

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
