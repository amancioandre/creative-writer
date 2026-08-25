import { describe, it, expect } from "vitest";
import { VaultWritingScope } from "../../../src/infrastructure/obsidian/VaultWritingScope";
import type { ScopeSettings } from "../../../src/domain/scope/NoteScope";

const fm: Record<string, Record<string, unknown> | undefined> = {
  "Novel/ch1.md": undefined,
  "Novel/memos/review.md": { "creative-writer": false },
  "Novel/Story map.md": { "creative-writer-storymap": 1 },
  "Creative Writer/Writing log.md": { "creative-writer": false, "creative-writer-log": 1 },
  "Journal/today.md": undefined,
  "Journal/ode.md": { "creative-writer": "yes" },
};
const app = { metadataCache: { getCache: (path: string) => (path in fm ? { frontmatter: fm[path] } : null) } };
const scopeWith = (scope: ScopeSettings, enabled = true) => new VaultWritingScope(app, () => ({ enabled, scope }), () => ["Novel/"]);

describe("VaultWritingScope", () => {
  it("under 'all', counts every note but the opted-out ones and the plugin's own", () => {
    const s = scopeWith({ mode: "all", folders: [] });
    expect(s.counts("Novel/ch1.md")).toBe(true);
    expect(s.counts("Journal/today.md")).toBe(true);
    expect(s.counts("Novel/memos/review.md")).toBe(false);
    expect(s.counts("Novel/Story map.md")).toBe(false);
    expect(s.counts("Creative Writer/Writing log.md")).toBe(false);
  });
  it("under 'projects', counts the declared project folders, and the notes that ask in", () => {
    const s = scopeWith({ mode: "projects", folders: [] });
    expect(s.counts("Novel/ch1.md")).toBe(true);
    expect(s.counts("Journal/today.md")).toBe(false);
    expect(s.counts("Journal/ode.md")).toBe(true);
    expect(s.counts("Novel/memos/review.md")).toBe(false);
  });
  it("under 'marked', a project's unmarked notes are still the story", () => {
    const s = scopeWith({ mode: "marked", folders: [] });
    expect(s.counts("Novel/ch1.md")).toBe(true);
    expect(s.counts("Novel/memos/review.md")).toBe(false);
    expect(s.counts("Journal/today.md")).toBe(false);
    expect(s.counts("Journal/ode.md")).toBe(true);
  });
  it("prefers the editor's text over the cache for the flag, so a just-typed front matter line takes effect at once", () => {
    const s = scopeWith({ mode: "all", folders: [] });
    expect(s.counts("Novel/ch1.md", "---\ncreative-writer: false\n---\nText")).toBe(false);
    expect(s.counts("Novel/memos/review.md", "Plain text, flag removed")).toBe(true);
    expect(s.counts("Novel/Story map.md", "---\ncreative-writer: true\n---\n")).toBe(false);
  });
  it("judges a path with no cache entry (deleted, or from another machine) by the path alone", () => {
    expect(scopeWith({ mode: "projects", folders: [] }).counts("Novel/gone.md")).toBe(true);
    expect(scopeWith({ mode: "projects", folders: [] }).counts("Elsewhere/gone.md")).toBe(false);
  });
  it("counts nothing when the master switch is off", () => {
    expect(scopeWith({ mode: "all", folders: [] }, false).counts("Novel/ch1.md")).toBe(false);
  });
});
