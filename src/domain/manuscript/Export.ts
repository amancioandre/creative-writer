import type { Manuscript, ManuscriptBlock } from "./Manuscript";

/**
 * The manuscript as one Markdown note: the same page the view shows, written
 * out for Pandoc, a reader, or a printer. Comments are the writer's and stay
 * behind; highlights are part of the text and go along. The note carries a
 * flag so the plugin never reads its own export as a chapter.
 */
export const MANUSCRIPT_EXPORT_FLAG = "creative-writer-manuscript";

const INLINE_COMMENT = /[ \t]*%%[^\n]*?%%/g;

export function renderManuscriptMarkdown(m: Manuscript): string {
  const parts: string[] = [];
  for (const item of m.items) {
    if (item.kind === "folder") { parts.push(`${"#".repeat(item.level)} ${item.title}`); continue; }
    if (item.showTitle) parts.push(`${"#".repeat(item.level)} ${item.title}`);
    for (const block of item.blocks) {
      const text = blockMarkdown(block);
      if (text !== null) parts.push(text);
    }
  }
  return parts.join("\n\n") + "\n";
}

function blockMarkdown(block: ManuscriptBlock): string | null {
  if (block.kind === "heading") return `${"#".repeat(block.level)} ${block.headingText}`;
  const stripped = block.markdown.replace(INLINE_COMMENT, "");
  return stripped.trim() === "" ? null : stripped;
}

export function exportNote(projectName: string, m: Manuscript): string {
  return [
    "---",
    "creative-writer: false",
    `${MANUSCRIPT_EXPORT_FLAG}: 1`,
    "---",
    `%% ${projectName}: the manuscript as one note, written by Creative Writer from ${m.notes} note${m.notes === 1 ? "" : "s"} (${m.words.toLocaleString("en")} words). A snapshot: export again to refresh it, delete it freely. Never read back as a chapter. %%`,
    "",
    renderManuscriptMarkdown(m),
  ].join("\n");
}
