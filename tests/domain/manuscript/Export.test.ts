import { describe, it, expect } from "vitest";
import { buildManuscript, DEFAULT_STRIP_PREFIX } from "../../../src/domain/manuscript/Manuscript";
import { exportNote, MANUSCRIPT_EXPORT_FLAG, renderManuscriptMarkdown } from "../../../src/domain/manuscript/Export";
import { isNoteCounted, isPluginDataNote } from "../../../src/domain/scope/NoteScope";

const opts = { folderDepth: 2, noteTitles: true, stripPrefix: DEFAULT_STRIP_PREFIX, demoteHeadings: true, proseOnly: false };
const notes = [
  { path: "Novel/01 Part One/01 Camp.md", frontmatter: {}, text: "# Camp\nMarta woke. %% CHECK: coat %%\n\n%%\nTODO: block\n%%\n\n==She stayed.==\n\nHe left. %% only a comment %%" },
  { path: "Novel/Epilogue.md", frontmatter: {}, text: "The end." },
];

describe("renderManuscriptMarkdown", () => {
  it("writes the outline, the notes and their blocks, leaving comments behind", () => {
    const md = renderManuscriptMarkdown(buildManuscript({ scope: "Novel/" }, notes, opts));
    expect(md).toBe("# Part One\n\n## Camp\n\nMarta woke.\n\n==She stayed.==\n\nHe left.\n\n# Epilogue\n\nThe end.\n");
  });
});

describe("exportNote", () => {
  it("carries the flag that keeps it out of every count and view", () => {
    const text = exportNote("Novel", buildManuscript({ scope: "Novel/" }, notes, opts));
    expect(text.startsWith(`---\ncreative-writer: false\n${MANUSCRIPT_EXPORT_FLAG}: 1\n---\n`)).toBe(true);
    expect(text).toContain("2 notes (9 words)");
    expect(isPluginDataNote({ [MANUSCRIPT_EXPORT_FLAG]: 1 })).toBe(true);
    expect(isNoteCounted({ enabled: true, scope: { mode: "all", folders: [] }, path: "Novel/Novel (manuscript).md", flag: null, frontmatter: { [MANUSCRIPT_EXPORT_FLAG]: 1 } })).toBe(false);
  });
});
