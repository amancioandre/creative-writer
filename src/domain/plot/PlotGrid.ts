import { basenameOf, normalise } from "../story/EntityIndex";
import { sceneKey, type Entity, type SceneRef, type StoryGraph } from "../story/StoryGraph";
import { parseColumnHeading, resolveThreadRef, type ColumnHeading, type ColumnKind } from "../threads/StoryThreadsNote";
import type { Thread, ThreadModel, ThreadRef } from "../threads/Thread";

export { parseColumnHeading, type ColumnHeading, type ColumnKind } from "../threads/StoryThreadsNote";

/**
 * The plot grid: a scene is a row, a hand-drawn thread is a column, and
 * the cell is what the thread is doing in the scene. A projection of the
 * threads model and the story graph, nothing stored: the columns are the
 * `## headings` of `Story threads.md`, the cells its stop lines, and a
 * cell's state is what its anchor says about the prose.
 *
 *   plan      a stop with no quote — a claim, typed ahead of the draft or from memory of it
 *   verified  a stop whose quote the code found in the scene
 *   broken    a stop whose quote no longer matches — the prose moved
 */
export type CellState = "empty" | "plan" | "verified" | "broken";

export interface GridCell {
  readonly state: CellState;
  /** The stop drawn in the cell: the first at this scene in note order. */
  readonly stop: ThreadRef | null;
  /** Further stops of the same thread at the same scene; the cell shows the first and "+n". */
  readonly more: readonly ThreadRef[];
  /** An arc column whose character is on the page here, with no stop: present, unmoved. */
  readonly presentUnmoved: boolean;
}

/** A column the project note names for a job: `plot-pov`, `plot-time`, `plot-theme`. */
export type SpecialColumn = "pov" | "time" | "main-theme";

/** What the project note names as the grid's POV, Time and main theme columns, by heading. */
export interface SpecialColumns {
  readonly pov?: string;
  readonly time?: string;
  readonly theme?: string;
}

export interface GridColumn {
  /** The thread's id in the threads model. */
  readonly id: string;
  /** The job the project note gave this column, if any: POV and Time are drawn in the derived block, the main theme first among the themes. */
  readonly special: SpecialColumn | null;
  readonly heading: ColumnHeading;
  readonly thread: Thread;
  /** The character an arc column is bound to, when the map knows one. */
  readonly entity: Entity | null;
  readonly cells: readonly GridCell[];
  /** Scenes with a stop. */
  readonly filled: number;
  readonly verified: number;
  readonly broken: number;
  /** "Present, unmoved" is a revision tool: it is armed once the column holds a verified stop. */
  readonly armed: boolean;
  /** Stops whose link resolved to no scene, kept visible as the threads chart keeps them. */
  readonly unresolved: readonly ThreadRef[];
}

export interface GridRow {
  readonly scene: SceneRef;
  /** Position on the manuscript axis, counting outline headings. */
  readonly index: number;
  readonly words: number;
  readonly bookmarked: boolean;
  /** Entity ids on the page, from the timeline. */
  readonly present: readonly string[];
  /** The model's events for the scene, from the map's readings. */
  readonly events: readonly string[];
  /** A heading with no prose yet: a scene planned, not written. */
  readonly outline: boolean;
  /** Whose eyes the scene is seen through, from the POV column: the name written, and the character it names when the map knows one. */
  readonly pov: { readonly name: string; readonly entity: Entity | null } | null;
}

export interface PlotGrid {
  readonly project: string;
  readonly rows: readonly GridRow[];
  /** In note order within each kind; arcs, then themes, then subplots, then free threads. */
  readonly columns: readonly GridColumn[];
  /** Headings whose prefix looked like a kind but was not one. */
  readonly unknownPrefixes: readonly string[];
  /** Who appears in a scene: the timeline's columns, folded into one of the grid's until expanded. */
  readonly cast: readonly Entity[];
  readonly cells: number;
  readonly filled: number;
  readonly verified: number;
  readonly broken: number;
}

export const EMPTY_PLOT_GRID: PlotGrid = { project: "", rows: [], columns: [], unknownPrefixes: [], cast: [], cells: 0, filled: 0, verified: 0, broken: 0 };

const CAST_ORDER: Record<Entity["kind"], number> = { character: 0, candidate: 1, faction: 2, location: 3, item: 4, event: 5, note: 6, reference: 7 };

const KIND_ORDER: Record<ColumnKind, number> = { arc: 0, theme: 1, subplot: 2, free: 3 };

/**
 * Rows are the graph's headings in manuscript order (the timeline's rows
 * plus outline headings), columns the writer's threads from the threads
 * model, whose refs already carry each stop's anchor.
 */
export function buildPlotGrid(graph: StoryGraph, model: ThreadModel, special: SpecialColumns = {}): PlotGrid {
  const bare = gridRows(graph);
  const rowIndex = new Map(bare.map((r) => [sceneKey(r.scene), r.index]));
  const writer = model.threads.filter((t) => t.kind === "writer");
  const same = (a: string, b: string | undefined) => !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const specialOf = (heading: string): SpecialColumn | null => same(heading, special.time) ? "time" : same(heading, special.pov) ? "pov" : same(heading, special.theme) ? "main-theme" : null;
  // Time and POV first, then the kinds in order, the main theme first among the themes, note order within each.
  const rank = (c: { heading: ColumnHeading; special: SpecialColumn | null }) => c.special === "time" ? -2 : c.special === "pov" ? -1 : KIND_ORDER[c.heading.kind] * 2 + (c.special === "main-theme" ? 0 : 1);
  const columns = writer
    .map((thread, order) => ({ thread, order, heading: parseColumnHeading(thread.label), special: specialOf(thread.label) }))
    .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
    .map(({ thread, heading, special: job }) => column(thread, heading, job, bare, rowIndex, graph.entities));
  const pov = columns.find((c) => c.special === "pov");
  const rows = bare.map((row) => {
    const name = pov?.cells[row.index]?.stop?.note.trim() ?? "";
    return name ? { ...row, pov: { name, entity: byName(name, graph.entities) } } : row;
  });
  const unknownPrefixes = columns.map((c) => c.heading.unknownPrefix).filter((p): p is string => !!p);
  const filled = columns.reduce((n, c) => n + c.filled, 0);
  const verified = columns.reduce((n, c) => n + c.verified, 0);
  const broken = columns.reduce((n, c) => n + c.broken, 0);
  const cast = graph.entities
    .filter((e) => e.appearances.length > 0 && e.kind !== "note" && e.kind !== "reference")
    .sort((a, b) => CAST_ORDER[a.kind] - CAST_ORDER[b.kind] || b.mentions - a.mentions);
  return { project: graph.project, rows, columns, unknownPrefixes, cast, cells: rows.length * columns.length, filled, verified, broken };
}

/** The timeline's rows, and between them the headings the timeline left out for having no prose. */
export function gridRows(graph: StoryGraph): GridRow[] {
  const byKey = new Map(graph.timeline.map((r) => [sceneKey(r.scene), r]));
  const headings = graph.headings ?? graph.timeline.map((r) => r.scene);
  const rows: GridRow[] = [];
  for (const scene of headings) {
    const row = byKey.get(sceneKey(scene));
    if (row) { rows.push({ scene: row.scene, index: rows.length, words: row.words, bookmarked: row.bookmarked, present: row.present, events: row.events, outline: false, pov: null }); continue; }
    // Prose before the first heading that has no prose is not a scene of anything.
    if (!scene.title) continue;
    rows.push({ scene, index: rows.length, words: 0, bookmarked: false, present: [], events: [], outline: true, pov: null });
  }
  return rows;
}

function column(thread: Thread, heading: ColumnHeading, special: SpecialColumn | null, rows: readonly GridRow[], rowIndex: ReadonlyMap<string, number>, entities: readonly Entity[]): GridColumn {
  const entity = heading.kind === "arc" ? bind(heading, entities) : null;
  const at = new Map<number, ThreadRef[]>();
  const unresolved: ThreadRef[] = [];
  for (const raw of thread.refs) {
    // The threads model resolves stops against prose scenes; a stop on an outline heading is planned, not lost.
    const ref = raw.unresolved ? resolveThreadRef({ link: raw.unresolved, note: raw.note, line: raw.line ?? 0, role: raw.role ?? "touch", quote: raw.quote ?? null }, rows) : raw;
    const i = ref.index < 0 ? undefined : rowIndex.get(sceneKey(ref.scene));
    if (i === undefined) { unresolved.push(ref); continue; }
    const list = at.get(i);
    if (list) list.push(ref); else at.set(i, [ref]);
  }
  let filled = 0, verified = 0, broken = 0;
  const cells = rows.map((row) => {
    const stops = at.get(row.index) ?? [];
    const stop = stops[0] ?? null;
    const state = stop ? stateOf(stop) : "empty";
    if (stop) filled++;
    if (state === "verified") verified++;
    if (state === "broken") broken++;
    const presentUnmoved = !stop && !!entity && row.present.includes(entity.id);
    return { state, stop, more: stops.slice(1), presentUnmoved };
  });
  return { id: thread.id, special, heading, thread, entity, cells, filled, verified, broken, armed: verified > 0, unresolved };
}

/** What a stop's anchor says: no quote is a plan, a found quote is verified, a lost one is broken. */
export function stateOf(stop: ThreadRef): CellState {
  if (!stop.quote) return "plan";
  return stop.anchor ? "verified" : "broken";
}

/** `## Arc: [[Anna]]` binds to the note at that path; `## Arc: Anna` to the entity called Anna, or known by that alias. */
function bind(heading: ColumnHeading, entities: readonly Entity[]): Entity | null {
  const target = heading.link?.trim();
  return target ? byName(target, entities) : null;
}

/** A name, a path, or an alias, as written in a heading or a POV cell (`[[Anna]]` and `Anna` alike). */
function byName(written: string, entities: readonly Entity[]): Entity | null {
  const want = normalise(basenameOf(written.replace(/^\[\[|\]\]$/g, "").replace(/\|.*$/, "").replace(/#.*$/, "")));
  if (!want) return null;
  return entities.find((e) => e.path && normalise(basenameOf(e.path)) === want)
    ?? entities.find((e) => normalise(e.name) === want)
    ?? entities.find((e) => e.aliases.some((a) => normalise(a) === want))
    ?? null;
}
