import { basenameOf } from "../story/EntityIndex";
import type { ProjectSpec } from "../progress/Project";
import type { GridCell, PlotGrid } from "./PlotGrid";

/** Front matter flag on a snapshot, so the plugin never reads its own table back as a chapter. */
export const GRID_SNAPSHOT_FLAG = "creative-writer-grid-snapshot";

/** `Plot grid · 2026-09-13.md` beside the project's notes; `Plot grid.md` for the undated export that is refreshed in place. */
export function snapshotPath(project: ProjectSpec, day: string | null): string {
  const folder = project.scope.endsWith("/") || project.scope === "" ? project.scope : project.scope.slice(0, project.scope.lastIndexOf("/") + 1);
  return `${folder}Plot grid${day ? ` · ${day}` : ""}.md`;
}

/**
 * The grid as a markdown table, dated, never read back: one row per scene
 * under its chapter, one column per thread, each cell its stop with the
 * role and a ✓ where the anchor was found. Two snapshots side by side are
 * the outline against the draft.
 */
export function snapshotNote(grid: PlotGrid, project: ProjectSpec, day: string | null): string {
  const columns = grid.columns;
  const head = ["Scene", "Words", ...columns.map((c) => c.heading.name)];
  const lines = [
    "---",
    "creative-writer: false",
    `${GRID_SNAPSHOT_FLAG}: 1`,
    "---",
    `%% ${project.name}: the plot grid${day ? ` on ${day}` : ""}, written by Creative Writer from Story threads.md. ${day ? "A snapshot" : "An export, refreshed on every export"}: ${grid.rows.length} scenes, ${columns.length} columns, ${grid.filled} cells filled, ${grid.verified} verified, ${grid.broken} broken. Never read back; delete it freely. %%`,
    "",
    `| ${head.map(cellText).join(" | ")} |`,
    `| ${head.map((_, i) => (i === 1 ? "---:" : "---")).join(" | ")} |`,
  ];
  let lastPath = "";
  for (const row of grid.rows) {
    if (row.scene.path !== lastPath) {
      lastPath = row.scene.path;
      lines.push(`| **${cellText(basenameOf(row.scene.path))}** |${" |".repeat(columns.length + 1)}`);
    }
    const cells = columns.map((c) => cellOf(c.cells[row.index]!));
    lines.push(`| ${cellText(row.scene.title || "(opening)")}${row.outline ? " *(outline)*" : ""} | ${row.outline ? "" : row.words.toLocaleString("en")} | ${cells.join(" | ")} |`);
  }
  return lines.join("\n") + "\n";
}

/** A snapshot read back for the tabs: the columns and rows of its table, as text. Read-only; the note is never edited from the grid. */
export interface SnapshotTable {
  readonly columns: readonly string[];
  readonly rows: readonly { readonly chapter: string; readonly scene: string; readonly words: string; readonly outline: boolean; readonly cells: readonly string[] }[];
  /** The line of explanation the snapshot carries, without its comment marks. */
  readonly summary: string;
}

const SNAPSHOT_NAME = /^Plot grid · (\d{4}-\d{2}-\d{2})(?: · (.+))?$/;

/** `Plot grid · 2026-09-13 · before the rewrite` → the day and the label the writer gave it by renaming the note. Null for any other note. */
export function snapshotName(path: string): { day: string; label: string } | null {
  const m = SNAPSHOT_NAME.exec(basenameOf(path));
  return m ? { day: m[1]!, label: m[2]?.trim() ?? "" } : null;
}

export function parseSnapshot(markdown: string): SnapshotTable {
  const lines = markdown.split("\n");
  const summary = lines.map((l) => /^%%\s*(.*?)\s*%%$/.exec(l.trim())?.[1]).find((x): x is string => !!x) ?? "";
  const table = lines.filter((l) => l.trim().startsWith("|"));
  if (table.length < 2) return { columns: [], rows: [], summary };
  const split = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
  const head = split(table[0]!);
  const columns = head.slice(2);
  const rows: { chapter: string; scene: string; words: string; outline: boolean; cells: string[] }[] = [];
  let chapter = "";
  for (const line of table.slice(2)) {
    const cells = split(line);
    const first = cells[0] ?? "";
    const band = /^\*\*(.+)\*\*$/.exec(first);
    if (band && cells.slice(1).every((c) => !c)) { chapter = band[1]!; continue; }
    const outline = /\*\(outline\)\*$/.test(first);
    rows.push({ chapter, scene: first.replace(/\s*\*\(outline\)\*$/, ""), words: cells[1] ?? "", outline, cells: columns.map((_, i) => cells[i + 2] ?? "") });
  }
  return { columns, rows, summary };
}

function cellOf(cell: GridCell): string {
  if (!cell.stop) return "";
  const s = cell.stop;
  const role = s.role && s.role !== "touch" ? `${s.role}: ` : "";
  const mark = cell.state === "verified" ? " ✓" : cell.state === "broken" ? " ✗" : "";
  const more = cell.more.length ? ` (+${cell.more.length})` : "";
  return cellText(`${role}${s.note || (s.quote ? `“${s.quote}”` : "")}`) + mark + more;
}

/** A table cell cannot hold a pipe or a line break. */
function cellText(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * The scene's sentences ranked against a lost quote: the ones sharing the
 * most content words come first, so re-anchoring a broken stop is a
 * choice among near matches, not a search. With no quote, document order.
 */
export function rankSentences(sentences: readonly string[], quote: string | null): { readonly text: string; readonly index: number; readonly score: number }[] {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").split(/\s+/).filter((w) => w.length > 2));
  const target = quote ? words(quote) : new Set<string>();
  const ranked = sentences.map((text, index) => {
    if (!target.size) return { text, index, score: 0 };
    const own = words(text);
    let shared = 0;
    for (const w of target) if (own.has(w)) shared++;
    return { text, index, score: shared / target.size };
  });
  return target.size ? [...ranked].sort((a, b) => b.score - a.score || a.index - b.index) : ranked;
}
