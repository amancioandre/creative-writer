import { basenameOf } from "../story/EntityIndex";
import type { GridColumn, GridRow, PlotGrid } from "./PlotGrid";

/**
 * Gaps the grid can count for itself, no model needed: a column with a
 * stop in few of the written scenes, and a character on the page for a
 * stretch of scenes while their arc says nothing. Findings, not
 * judgements: the number is exact, what to do about it is the writer's.
 */
export type GapKind = "thin-column" | "unmoved-stretch";

export interface Gap {
  readonly kind: GapKind;
  /** The column's heading, so the finding can be followed to its cells. */
  readonly column: string;
  readonly text: string;
  /** Row indexes the finding points at: the whole column's prose rows, or the stretch. */
  readonly rows: readonly number[];
}

export interface GapOptions {
  /** Written scenes a project needs before a thin column is worth pointing out. */
  readonly minScenes: number;
  /** A column with a stop in less than this share of the written scenes is thin. */
  readonly thinShare: number;
  /** A character present with no stop for at least this many scenes in a row is unmoved. */
  readonly stretch: number;
}

export const DEFAULT_GAP_OPTIONS: GapOptions = { minScenes: 8, thinShare: 0.25, stretch: 3 };

export function findGaps(grid: PlotGrid, options: GapOptions = DEFAULT_GAP_OPTIONS): Gap[] {
  const out: Gap[] = [];
  const prose = grid.rows.filter((r) => !r.outline);
  const label = (r: GridRow) => r.scene.title || basenameOf(r.scene.path);
  for (const c of grid.columns) {
    if (c.special === "pov" || c.special === "time" || c.special === "beats") continue;
    if (prose.length >= options.minScenes) {
      const filled = prose.filter((r) => c.cells[r.index]!.stop).length;
      if (filled / prose.length < options.thinShare) out.push({ kind: "thin-column", column: c.heading.heading, text: `${c.heading.name} has a stop in ${filled} of ${prose.length} written scenes.`, rows: prose.map((r) => r.index) });
    }
    if (c.entity) for (const run of stretches(c, prose, options.stretch)) {
      const first = grid.rows[run[0]!]!, last = grid.rows[run[run.length - 1]!]!;
      out.push({ kind: "unmoved-stretch", column: c.heading.heading, text: `${c.entity.name} is on the page in ${run.length} scenes in a row, ${label(first)} to ${label(last)}, and the arc has no stop there.`, rows: run });
    }
  }
  return out;
}

/** Runs of at least `min` consecutive written scenes where the arc's character is present and the cell is empty. */
function stretches(c: GridColumn, prose: readonly GridRow[], min: number): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  const flush = () => { if (run.length >= min) runs.push(run); run = []; };
  for (const r of prose) {
    const cell = c.cells[r.index]!;
    if (cell.presentUnmoved && !cell.stop) run.push(r.index); else flush();
  }
  flush();
  return runs;
}
