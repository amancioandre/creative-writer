import type { SceneRef } from "./StoryGraph";

/**
 * What survives between sessions — and between devices. Everything else in
 * the story map is rebuilt from the notes, so only model readings need a
 * home. They live in a markdown note inside the project folder (front
 * matter + one JSON block) because markdown is the one file type every
 * sync method carries; a `.json` beside the notes is not.
 */
export const STORY_MAP_VERSION = 1;
export const STORY_MAP_NOTE = "Story map.md";
export const STORY_MAP_FLAG = "creative-writer-storymap";

export interface ModelRelation {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly evidence: string;
}

export interface ModelReference {
  /** "Orpheus and Eurydice", "the 1755 Lisbon earthquake" */
  readonly name: string;
  readonly kind: "myth" | "history" | "literature" | "scripture" | "other";
  /** Which entity in the scene carries the echo, if any (an entity name). */
  readonly about: string;
  readonly note: string;
  readonly evidence: string;
}

export interface ModelEvent {
  readonly summary: string;
  readonly participants: readonly string[];
  readonly evidence: string;
}

/** One model reading of one scene. */
export interface SceneReading {
  readonly scene: SceneRef;
  /** Hash of the scene's prose when it was read; a mismatch marks the reading stale. */
  readonly hash: string;
  readonly model: string;
  readonly relations: readonly ModelRelation[];
  readonly references: readonly ModelReference[];
  readonly events: readonly ModelEvent[];
}

/** Where the writer put a node by hand. Only pinned nodes are remembered; the rest settle deterministically. */
export interface LayoutPoint {
  readonly x: number;
  readonly y: number;
}

export type Layout = Readonly<Record<string, LayoutPoint>>;

export interface StoryMapFile {
  readonly version: number;
  readonly readings: readonly SceneReading[];
  /** Node id → hand-placed position. */
  readonly layout: Layout;
}

export const EMPTY_STORY_MAP_FILE: StoryMapFile = { version: STORY_MAP_VERSION, readings: [], layout: {} };

export function normalizeStoryMapFile(raw: unknown): StoryMapFile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const layout: Record<string, LayoutPoint> = {};
  const rawLayout = (r.layout && typeof r.layout === "object" ? r.layout : {}) as Record<string, unknown>;
  for (const [id, v] of Object.entries(rawLayout)) {
    const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    if (typeof p.x === "number" && Number.isFinite(p.x) && typeof p.y === "number" && Number.isFinite(p.y)) layout[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  }
  const readings: SceneReading[] = [];
  for (const item of Array.isArray(r.readings) ? (r.readings as unknown[]) : []) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const scene = (o.scene && typeof o.scene === "object" ? o.scene : {}) as Record<string, unknown>;
    if (typeof scene.path !== "string" || typeof o.hash !== "string") continue;
    readings.push({
      scene: { path: scene.path, title: typeof scene.title === "string" ? scene.title : "", line: typeof scene.line === "number" ? scene.line : 0 },
      hash: o.hash,
      model: typeof o.model === "string" ? o.model : "",
      relations: list(o.relations).map((x) => ({ from: str(x.from), to: str(x.to), label: str(x.label), evidence: str(x.evidence) })).filter((x) => x.from && x.to),
      references: list(o.references).map((x) => ({ name: str(x.name), kind: refKind(x.kind), about: str(x.about), note: str(x.note), evidence: str(x.evidence) })).filter((x) => x.name),
      events: list(o.events).map((x) => ({ summary: str(x.summary), participants: Array.isArray(x.participants) ? (x.participants as unknown[]).map(str).filter(Boolean) : [], evidence: str(x.evidence) })).filter((x) => x.summary),
    });
  }
  return { version: STORY_MAP_VERSION, readings, layout };
}

/** Replaces any earlier reading of the same scene. Readings are keyed by path and title so a renamed heading reads as new. */
export function putReading(file: StoryMapFile, reading: SceneReading): StoryMapFile {
  const key = (s: SceneRef) => `${s.path}#${s.title}`;
  const rest = file.readings.filter((r) => key(r.scene) !== key(reading.scene));
  return { ...file, version: STORY_MAP_VERSION, readings: [...rest, reading] };
}

/** Replaces the remembered layout wholesale — the view owns which nodes are pinned. */
export function setLayout(file: StoryMapFile, layout: Layout): StoryMapFile {
  const next: Record<string, LayoutPoint> = {};
  for (const [id, p] of Object.entries(layout)) next[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  return { ...file, layout: next };
}

export function renameReadings(file: StoryMapFile, from: string, to: string): StoryMapFile {
  const movesLayout = from in file.layout, movesReadings = file.readings.some((r) => r.scene.path === from);
  if (!movesLayout && !movesReadings) return file;
  const layout = { ...file.layout };
  if (movesLayout) { layout[to] = layout[from]!; delete layout[from]; }
  return { ...file, layout, readings: file.readings.map((r) => (r.scene.path === from ? { ...r, scene: { ...r.scene, path: to } } : r)) };
}

/** The note's body: a short explanation for a human who opens it, then the data. */
export function serializeStoryMapNote(file: StoryMapFile, project: string): string {
  return [
    "---",
    "creative-writer: false",
    `${STORY_MAP_FLAG}: ${STORY_MAP_VERSION}`,
    "---",
    `Story map data for **${project}**. Creative Writer rebuilds the map from your notes; this file only keeps what the model inferred (relationships, references, events per scene) and where you pinned nodes by hand, so both follow the project across devices. Relationships you draw yourself live in the entity notes, not here. Safe to sync, safe to delete — you would just re-run the analysis and re-place pinned nodes.`,
    "",
    "```json",
    JSON.stringify(file, null, 2),
    "```",
    "",
  ].join("\n");
}

const BLOCK = /```json\s*\n([\s\S]*?)\n```/;

export function parseStoryMapNote(markdown: string): StoryMapFile {
  const m = BLOCK.exec(markdown);
  if (!m) return EMPTY_STORY_MAP_FILE;
  try {
    return normalizeStoryMapFile(JSON.parse(m[1]!));
  } catch {
    return EMPTY_STORY_MAP_FILE;
  }
}

function list(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => (x && typeof x === "object" ? x : {}) as Record<string, unknown>) : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function refKind(v: unknown): ModelReference["kind"] {
  return v === "myth" || v === "history" || v === "literature" || v === "scripture" ? v : "other";
}
