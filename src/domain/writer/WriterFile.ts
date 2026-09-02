import { DEFAULT_FRAMEWORK, type Framework, type GroupDef, frameworkById, groupId, isHexColour, normalizeFramework } from "./Framework";
import { DEFAULT_PREFIX, normalizePrefix } from "./Tags";

/**
 * The one file a vault's writer board keeps: `Writer.writer`, JSON with its
 * own extension so that opening it opens the board, as `.canvas` does.
 *
 * It holds only what the notes cannot: the framework, colour overrides,
 * where cards and groups sit, named edges and the view. Cards themselves
 * are notes carrying `#writer/<group>` tags; stories are declared projects;
 * uses come from links. All of that is rebuilt from the vault every time,
 * so a lost or unsynced file costs positions and edge names, never content.
 *
 * Obsidian Sync carries a `.writer` file only with *Sync all other types*
 * on; the guide says so.
 */
export const WRITER_VERSION = 1;
export const WRITER_EXTENSION = "writer";
export const WRITER_FILE_NAME = `Writer.${WRITER_EXTENSION}`;

export interface Point { readonly x: number; readonly y: number }
export interface Rect extends Point { readonly w: number; readonly h: number }
export interface ViewTransform extends Point { readonly k: number }

/** A line the writer named between two cards that link to each other. */
export interface NamedEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  /** Hex colour; "" for the default. */
  readonly colour: string;
}

export interface WriterFile {
  readonly version: number;
  /** A shipped framework id, or one written inline. */
  readonly framework: string | Framework;
  /** The nested-tag prefix cards are declared with. */
  readonly prefix: string;
  /** Group id to colour override. */
  readonly colours: Readonly<Record<string, string>>;
  /** Group id to where its region sits. */
  readonly groups: Readonly<Record<string, Rect>>;
  /** Note path to where its card sits. */
  readonly cards: Readonly<Record<string, Point>>;
  readonly edges: readonly NamedEdge[];
  readonly view: ViewTransform | null;
}

export const EMPTY_WRITER_FILE: WriterFile = { version: WRITER_VERSION, framework: DEFAULT_FRAMEWORK.id, prefix: DEFAULT_PREFIX, colours: {}, groups: {}, cards: {}, edges: [], view: null };

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

export function normalizeWriterFile(raw: unknown): WriterFile {
  const r = obj(raw);
  const framework: string | Framework = typeof r.framework === "string" && frameworkById(r.framework) ? r.framework : normalizeFramework(r.framework) ?? DEFAULT_FRAMEWORK.id;
  const colours: Record<string, string> = {};
  for (const [id, c] of Object.entries(obj(r.colours))) {
    const gid = groupId(id);
    if (gid && isHexColour(c)) colours[gid] = c;
  }
  const groups: Record<string, Rect> = {};
  for (const [id, v] of Object.entries(obj(r.groups))) {
    const p = obj(v);
    const gid = groupId(id);
    if (gid && num(p.x) && num(p.y) && num(p.w) && num(p.h) && p.w > 0 && p.h > 0) groups[gid] = { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h) };
  }
  const cards: Record<string, Point> = {};
  for (const [path, v] of Object.entries(obj(r.cards))) {
    const p = obj(v);
    if (path && num(p.x) && num(p.y)) cards[path] = { x: Math.round(p.x), y: Math.round(p.y) };
  }
  const edges: NamedEdge[] = [];
  const seen = new Set<string>();
  for (const v of Array.isArray(r.edges) ? (r.edges as unknown[]) : []) {
    const e = obj(v);
    if (typeof e.from !== "string" || typeof e.to !== "string" || !e.from || !e.to || e.from === e.to) continue;
    const label = typeof e.label === "string" ? e.label.trim() : "";
    const key = edgeKey(e.from, e.to, label);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: e.from, to: e.to, label, colour: isHexColour(e.colour) ? e.colour : "" });
  }
  const rv = r.view && typeof r.view === "object" ? obj(r.view) : null;
  const view = rv && num(rv.x) && num(rv.y) && num(rv.k) && rv.k > 0 ? { x: rv.x, y: rv.y, k: rv.k } : null;
  return { version: WRITER_VERSION, framework, prefix: normalizePrefix(r.prefix), colours, groups, cards, edges, view };
}

export function parseWriterFile(text: string): WriterFile {
  try {
    return normalizeWriterFile(JSON.parse(text));
  } catch {
    return EMPTY_WRITER_FILE;
  }
}

export function serializeWriterFile(file: WriterFile): string {
  return JSON.stringify({ ...file, version: WRITER_VERSION }, null, 2) + "\n";
}

/** The framework in force: a shipped one by id, the inline one, or the default. */
export function resolveFramework(file: WriterFile): Framework {
  return typeof file.framework === "string" ? frameworkById(file.framework) ?? DEFAULT_FRAMEWORK : file.framework;
}

/** A group's colour with the writer's override applied. */
export function colourOf(file: WriterFile, group: GroupDef): string {
  return file.colours[group.id] ?? group.colour;
}

export function setFramework(file: WriterFile, framework: string | Framework): WriterFile {
  return normalizeWriterFile({ ...file, framework });
}

export function setColour(file: WriterFile, group: string, colour: string | null): WriterFile {
  const colours = { ...file.colours };
  if (colour && isHexColour(colour)) colours[group] = colour;
  else delete colours[group];
  return { ...file, colours };
}

export function placeCard(file: WriterFile, path: string, at: Point | null): WriterFile {
  const cards = { ...file.cards };
  if (at) cards[path] = { x: Math.round(at.x), y: Math.round(at.y) };
  else delete cards[path];
  return { ...file, cards };
}

export function placeGroup(file: WriterFile, group: string, rect: Rect | null): WriterFile {
  const groups = { ...file.groups };
  if (rect && rect.w > 0 && rect.h > 0) groups[group] = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
  else delete groups[group];
  return { ...file, groups };
}

const edgeKey = (from: string, to: string, label: string) => [from, to].sort().join(" ") + " " + label.toLowerCase();

/** Adds or replaces an edge; direction does not matter, the label does. `previousLabel` renames one in place. */
export function putEdge(file: WriterFile, edge: NamedEdge, previousLabel?: string): WriterFile {
  const label = edge.label.trim();
  const drop = new Set([edgeKey(edge.from, edge.to, label), edgeKey(edge.from, edge.to, previousLabel ?? label)]);
  const rest = file.edges.filter((e) => !drop.has(edgeKey(e.from, e.to, e.label)));
  return { ...file, edges: [...rest, { from: edge.from, to: edge.to, label, colour: isHexColour(edge.colour) ? edge.colour : "" }] };
}

export function removeEdge(file: WriterFile, from: string, to: string, label: string): WriterFile {
  const key = edgeKey(from, to, label);
  const edges = file.edges.filter((e) => edgeKey(e.from, e.to, e.label) !== key);
  return edges.length === file.edges.length ? file : { ...file, edges };
}

/** Follows a note rename: its position and its edges. */
export function renameCard(file: WriterFile, from: string, to: string): WriterFile {
  const movesCard = from in file.cards, movesEdges = file.edges.some((e) => e.from === from || e.to === from);
  if (!movesCard && !movesEdges) return file;
  const cards = { ...file.cards };
  if (movesCard) { cards[to] = cards[from]!; delete cards[from]; }
  const edges = file.edges.map((e) => ({ ...e, from: e.from === from ? to : e.from, to: e.to === from ? to : e.to }));
  return { ...file, cards, edges };
}

export function setView(file: WriterFile, view: ViewTransform | null): WriterFile {
  return { ...file, view: view && view.k > 0 ? view : null };
}
