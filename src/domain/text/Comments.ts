/**
 * Comments in a note are not prose. Two syntaxes are read: HTML's
 * `<!-- … -->`, which every markdown tool hides, and Obsidian's `%% … %%`,
 * which only Obsidian does. Both may span lines. The plugin reads both
 * and, where it writes a comment of its own for the manuscript (the plot
 * grid's logline under a scene heading), writes the HTML one, so the
 * note opens clean in any other writing software.
 */
export type CommentState = null | "html" | "obsidian";

/** Strips the comments from one line, carrying an open block on to the next line. */
export function stripComments(line: string, state: CommentState = null): { text: string; state: CommentState } {
  let out = "";
  let s = state;
  let i = 0;
  while (i < line.length) {
    if (s === "html") { const j = line.indexOf("-->", i); if (j < 0) return { text: out, state: s }; i = j + 3; s = null; continue; }
    if (s === "obsidian") { const j = line.indexOf("%%", i); if (j < 0) return { text: out, state: s }; i = j + 2; s = null; continue; }
    const h = line.indexOf("<!--", i), o = line.indexOf("%%", i);
    const next = h < 0 ? o : o < 0 ? h : Math.min(h, o);
    if (next < 0) { out += line.slice(i); break; }
    out += line.slice(i, next);
    if (next === h) { s = "html"; i = next + 4; } else { s = "obsidian"; i = next + 2; }
  }
  return { text: out, state: s };
}

/** The line the plugin writes for a hidden note of its own. XML forbids `--` inside a comment, so a double hyphen is softened. */
export function htmlComment(text: string): string {
  return `<!-- ${text.replace(/--+/g, "–").replace(/\s+/g, " ").trim()} -->`;
}

const HTML_COMMENT_LINE = /^\s*<!--\s*([\s\S]*?)\s*-->\s*$/;
const OBSIDIAN_COMMENT_LINE = /^\s*%%\s*([\s\S]*?)\s*%%\s*$/;

/** The text of a line that is nothing but one comment, in either syntax; null for anything else. */
export function commentLine(line: string): string | null {
  const m = HTML_COMMENT_LINE.exec(line) ?? OBSIDIAN_COMMENT_LINE.exec(line);
  return m ? m[1]!.trim() : null;
}
