import { STOP_ROLES } from "../threads/Thread";
import type { Thread, ThreadModel, ThreadRef } from "../threads/Thread";
import type { GridColumn, GridRow } from "./PlotGrid";

/**
 * The value gauge: every scene turns on a value, and the running total
 * shows where the story flips. A column's scale is an odd, ordered list
 * of words, most negative first, written as one comment line under its
 * heading; a stop's keyword is the word the scene mostly appears to be,
 * and its place on the scale is the scene's charge. Nothing here is
 * stored: charge, running total, inversions and disagreements are
 * counted each time a view draws, from the lines the writer typed.
 */
export const MIN_SCALE = 3;
export const MAX_SCALE = 11;
/** Lanes drawn side by side before the rest fold into a picker. */
export const MAX_LANES = 3;
/** Separate pipes read at a glance up to this many; past it the first three merge into one block. */
export const PIPE_GROUP = 3;

export type ScaleProblem = "short" | "long" | "even" | "duplicate" | "role-word";

export interface Scale {
  readonly words: readonly string[];
  /** Index of the neutral word, the middle one. */
  readonly neutral: number;
  /** Steps either side of neutral: 2 on a five-word scale. */
  readonly steps: number;
}

/** What is wrong with a list of words as a scale, or null when it is one. */
export function checkScale(words: readonly string[]): ScaleProblem | null {
  const clean = words.map((w) => w.trim()).filter(Boolean);
  if (clean.length % 2 === 0) return "even";
  if (clean.length < MIN_SCALE) return "short";
  if (clean.length > MAX_SCALE) return "long";
  const lower = clean.map((w) => w.toLowerCase());
  if (new Set(lower).size !== lower.length) return "duplicate";
  if (lower.some((w) => (STOP_ROLES as readonly string[]).includes(w))) return "role-word";
  return null;
}

/** The problem in the writer's words, for a header or a sheet. */
export function describeScaleProblem(problem: ScaleProblem): string {
  switch (problem) {
    case "short": return `a scale needs at least ${MIN_SCALE} words`;
    case "long": return `a scale takes at most ${MAX_SCALE} words`;
    case "even": return "a scale needs an odd number of words, so the middle one is neutral";
    case "duplicate": return "a scale cannot repeat a word";
    case "role-word": return "a scale cannot use a role word (plant, touch, payoff, reversal, want, lie, turn, truth)";
  }
}

/** The words as a scale, or null when they are not one. */
export function readScale(words: readonly string[] | null | undefined): Scale | null {
  if (!words || checkScale(words)) return null;
  const clean = words.map((w) => w.trim()).filter(Boolean);
  return { words: clean, neutral: (clean.length - 1) / 2, steps: (clean.length - 1) / 2 };
}

/** The word's charge on the scale: its position minus the middle, so hate is −2 and love +2 on five words. Null off the scale. */
export function chargeOf(word: string | null | undefined, scale: Scale): number | null {
  if (!word) return null;
  const i = scale.words.findIndex((w) => w.toLowerCase() === word.trim().toLowerCase());
  return i < 0 ? null : i - scale.neutral;
}

/** How a charge is drawn: up to three separate pipes; from four, one block of three and singles beside it. */
export function pipesOf(charge: number): { readonly block: boolean; readonly singles: number } {
  const n = Math.abs(charge);
  return n > PIPE_GROUP ? { block: true, singles: n - PIPE_GROUP } : { block: false, singles: n };
}

export interface GaugeRow {
  /** The scene's charge, or null when no stop names a word. */
  readonly charge: number | null;
  /** The keyword that gave the charge, as the scale spells it. */
  readonly keyword: string | null;
  /** Two stops at the scene name different words: the code does not choose, the row is unread. */
  readonly conflict: readonly string[] | null;
  /** The running total after this row. */
  readonly total: number;
  /** The total changed sign at this row: the story flipped. */
  readonly inversion: boolean;
  /** The stop that gave the charge carries a quote: the line that marks the value. */
  readonly marked: boolean;
  /** The move from the last charged scene to this one; null on the first charged scene and on rows with no charge. */
  readonly delta: number | null;
  /** The move changed direction: the story was sinking and now rises, or the reverse, whichever side of neutral it is on. */
  readonly turn: boolean;
}

/** What a row's stops say for the gauge: each stop's word, and whether a quote marks it. */
export interface StopWord {
  readonly keyword: string | null;
  readonly marked: boolean;
}

/** A column or a thread read down its rows: the charges, the running total, the flips. */
export interface GaugeSeries {
  readonly scale: Scale;
  /** One per row, in the order given. */
  readonly rows: readonly GaugeRow[];
  /** Rows with a charge. */
  readonly charged: number;
  /** Rows where two stops disagree. */
  readonly unread: number;
  /** Row positions of the inversions. */
  readonly inversions: readonly number[];
  /** Row positions of the turns: where the scene-to-scene move changes direction. */
  readonly turns: readonly number[];
  /** The largest total reached, absolute, so the line can be scaled to the lane. */
  readonly maxTotal: number;
  /** Steps of total per step of lane width: 1 while the line fits the pipes' unit, more when it would leave the lane. */
  readonly unit: number;
}

export interface Lane extends GaugeSeries {
  readonly column: GridColumn;
}

/** A hand-drawn thread as a lane: the same series, read along the threads chart's axis. */
export interface ThreadLane extends GaugeSeries {
  readonly thread: Thread;
}

/**
 * The series: the charge per row, the running total in the rows' order,
 * and the rows where the total changes sign. Zero holds the sign: a
 * total that lands on zero is not yet an inversion. Empty rows and
 * neutral rows both hold the total; two stops that disagree give no
 * charge and count as unread.
 */
export function gaugeSeries(scale: Scale, rows: readonly (readonly StopWord[])[]): GaugeSeries {
  const out: GaugeRow[] = [];
  let total = 0, lastSign = 0, charged = 0, unread = 0, maxTotal = 0;
  let lastCharge: number | null = null, lastDir = 0;
  const inversions: number[] = [];
  const turns: number[] = [];
  rows.forEach((stops, position) => {
    const words = stops.map((s) => s.keyword).filter((w): w is string => !!w);
    const distinct = words.filter((w, i) => words.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i);
    const conflict = distinct.length > 1 ? distinct : null;
    const keyword = distinct.length === 1 ? distinct[0]! : null;
    const charge = conflict ? null : chargeOf(keyword, scale);
    if (charge !== null) { total += charge; charged++; }
    if (conflict) unread++;
    const sign = Math.sign(total);
    const inversion = sign !== 0 && lastSign !== 0 && sign !== lastSign;
    if (sign !== 0) lastSign = sign;
    if (inversion) inversions.push(position);
    maxTotal = Math.max(maxTotal, Math.abs(total));
    // The micro movement: the step from the last charged scene, and whether it turned the other way.
    const delta = charge !== null && lastCharge !== null ? charge - lastCharge : null;
    const dir = delta === null ? 0 : Math.sign(delta);
    const turn = dir !== 0 && lastDir !== 0 && dir !== lastDir;
    if (dir !== 0) lastDir = dir;
    if (charge !== null) lastCharge = charge;
    if (turn) turns.push(position);
    const giver = keyword ? stops.find((s) => s.keyword && s.keyword.toLowerCase() === keyword.toLowerCase()) ?? null : null;
    out.push({ charge, keyword: charge === null ? null : keyword, conflict, total, inversion, marked: !!giver?.marked, delta, turn });
  });
  return { scale, rows: out, charged, unread, inversions, turns, maxTotal, unit: Math.max(1, Math.ceil(maxTotal / scale.steps)) };
}

const stopWord = (s: ThreadRef | null | undefined): StopWord | null => (s ? { keyword: s.keyword ?? null, marked: !!s.quote } : null);

/** One column read down the grid's rows, in the order given. Null when the column has no readable scale. */
export function gaugeLane(column: GridColumn, rows: readonly GridRow[]): Lane | null {
  const scale = readScale(column.scale);
  if (!scale) return null;
  const series = gaugeSeries(scale, rows.map((row) => { const cell = column.cells[row.index]; return cell ? [stopWord(cell.stop), ...cell.more.map(stopWord)].filter((s): s is StopWord => s !== null) : []; }));
  return { column, ...series };
}

/** Every hand-drawn thread with a readable scale, read along the model's scenes: the lanes the threads chart and the manuscript draw. */
export function threadLanes(model: ThreadModel): ThreadLane[] {
  const out: ThreadLane[] = [];
  for (const thread of model.threads) {
    if (thread.kind !== "writer") continue;
    const scale = readScale(thread.scale);
    if (!scale) continue;
    const rows: StopWord[][] = model.scenes.map(() => []);
    for (const ref of thread.refs) if (ref.index >= 0 && ref.index < rows.length) rows[ref.index]!.push({ keyword: ref.keyword ?? null, marked: !!ref.quote });
    out.push({ thread, ...gaugeSeries(scale, rows) });
  }
  return out;
}

/** Row positions where two lanes carry opposite signs: the audience loves what the character hates. Signs only, since scales of different lengths do not compare in size. */
export function disagreements(a: Lane, b: Lane): number[] {
  const out: number[] = [];
  const n = Math.min(a.rows.length, b.rows.length);
  for (let i = 0; i < n; i++) {
    const x = a.rows[i]!.charge, y = b.rows[i]!.charge;
    if (x !== null && y !== null && Math.sign(x) !== 0 && Math.sign(y) !== 0 && Math.sign(x) !== Math.sign(y)) out.push(i);
  }
  return out;
}

/** The lanes of a grid: every column with a readable scale, in the grid's order. */
export function gaugeLanes(columns: readonly GridColumn[], rows: readonly GridRow[]): Lane[] {
  return columns.map((c) => gaugeLane(c, rows)).filter((l): l is Lane => l !== null);
}
