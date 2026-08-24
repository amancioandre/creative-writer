import type { SceneRef } from "./StoryGraph";

/**
 * What survives between sessions — and between devices. Everything else in
 * the story map is rebuilt from the notes, so only model readings need a
 * home. They live in a markdown note inside the project folder (front
 * matter + one JSON block) because markdown is the one file type every
 * sync method carries; a `.json` beside the notes is not.
 *
 * Version 2 adds two things the story threads view needs: per-scene fact
 * readings (kept in their own list, not on the relation reading, because
 * they come from a separate prompt and must go stale separately), and the
 * contradictions the writer has looked at and waved away.
 */
export const STORY_MAP_VERSION = 2;
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

/** A concrete, checkable thing a scene states: Ilse / eye colour / green. */
export interface ModelFact {
  /** Canonical entity name. */
  readonly subject: string;
  /** "eye colour", "age", "hometown" — as the model wrote it; compared normalised. */
  readonly attribute: string;
  readonly value: string;
  /** Verbatim quote from the scene. */
  readonly evidence: string;
}

/** One facts reading of one scene. Absent from the list = never read; `facts: []` = read, nothing stated. */
export interface FactReading {
  readonly scene: SceneRef;
  /** Hash of the prose when read — independent of the relation reading's hash. */
  readonly hash: string;
  readonly model: string;
  /** Which version of the prompt produced it; a newer prompt makes the reading worth redoing. */
  readonly rulebook: string;
  readonly facts: readonly ModelFact[];
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
  readonly facts: readonly FactReading[];
  /** Contradiction keys the writer dismissed (see `contradictionKey` in domain/threads). */
  readonly dismissed: readonly string[];
  /** Node id → hand-placed position. */
  readonly layout: Layout;
}

export const EMPTY_STORY_MAP_FILE: StoryMapFile = { version: STORY_MAP_VERSION, readings: [], facts: [], dismissed: [], layout: {} };

export function normalizeStoryMapFile(raw: unknown): StoryMapFile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const layout: Record<string, LayoutPoint> = {};
  const rawLayout = (r.layout && typeof r.layout === "object" ? r.layout : {}) as Record<string, unknown>;
  for (const [id, v] of Object.entries(rawLayout)) {
    const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    if (typeof p.x === "number" && Number.isFinite(p.x) && typeof p.y === "number" && Number.isFinite(p.y)) layout[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  }
  const readings: SceneReading[] = [];
  for (const o of list(r.readings)) {
    const scene = sceneOf(o);
    if (!scene || typeof o.hash !== "string") continue;
    readings.push({
      scene,
      hash: o.hash,
      model: str(o.model),
      relations: list(o.relations).map((x) => ({ from: str(x.from), to: str(x.to), label: str(x.label), evidence: str(x.evidence) })).filter((x) => x.from && x.to),
      references: list(o.references).map((x) => ({ name: str(x.name), kind: refKind(x.kind), about: str(x.about), note: str(x.note), evidence: str(x.evidence) })).filter((x) => x.name),
      events: list(o.events).map((x) => ({ summary: str(x.summary), participants: Array.isArray(x.participants) ? (x.participants as unknown[]).map(str).filter(Boolean) : [], evidence: str(x.evidence) })).filter((x) => x.summary),
    });
  }
  const facts: FactReading[] = [];
  for (const o of list(r.facts)) {
    const scene = sceneOf(o);
    if (!scene || typeof o.hash !== "string") continue;
    facts.push({
      scene,
      hash: o.hash,
      model: str(o.model),
      rulebook: str(o.rulebook),
      facts: list(o.facts).map((x) => ({ subject: str(x.subject), attribute: str(x.attribute), value: str(x.value), evidence: str(x.evidence) })).filter((x) => x.subject && x.attribute && x.value && x.evidence),
    });
  }
  const dismissed = [...new Set((Array.isArray(r.dismissed) ? (r.dismissed as unknown[]) : []).filter((x): x is string => typeof x === "string" && x.length > 0))];
  return { version: STORY_MAP_VERSION, readings, facts, dismissed, layout };
}

const key = (s: SceneRef) => `${s.path}#${s.title}`;

/** Replaces any earlier reading of the same scene. Readings are keyed by path and title so a renamed heading reads as new. */
export function putReading(file: StoryMapFile, reading: SceneReading): StoryMapFile {
  const rest = file.readings.filter((r) => key(r.scene) !== key(reading.scene));
  return { ...file, version: STORY_MAP_VERSION, readings: [...rest, reading] };
}

/** Same discipline for facts; relation readings are untouched. */
export function putFactReading(file: StoryMapFile, reading: FactReading): StoryMapFile {
  const rest = file.facts.filter((r) => key(r.scene) !== key(reading.scene));
  return { ...file, version: STORY_MAP_VERSION, facts: [...rest, reading] };
}

export function dismissContradiction(file: StoryMapFile, contradictionKey: string): StoryMapFile {
  if (file.dismissed.includes(contradictionKey)) return file;
  return { ...file, version: STORY_MAP_VERSION, dismissed: [...file.dismissed, contradictionKey] };
}

export function undismissContradiction(file: StoryMapFile, contradictionKey: string): StoryMapFile {
  if (!file.dismissed.includes(contradictionKey)) return file;
  return { ...file, version: STORY_MAP_VERSION, dismissed: file.dismissed.filter((k) => k !== contradictionKey) };
}

/** Replaces the remembered layout wholesale — the view owns which nodes are pinned. */
export function setLayout(file: StoryMapFile, layout: Layout): StoryMapFile {
  const next: Record<string, LayoutPoint> = {};
  for (const [id, p] of Object.entries(layout)) next[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  return { ...file, layout: next };
}

export function renameReadings(file: StoryMapFile, from: string, to: string): StoryMapFile {
  const movesLayout = from in file.layout, movesReadings = file.readings.some((r) => r.scene.path === from), movesFacts = file.facts.some((r) => r.scene.path === from);
  if (!movesLayout && !movesReadings && !movesFacts) return file;
  const layout = { ...file.layout };
  if (movesLayout) { layout[to] = layout[from]!; delete layout[from]; }
  const move = <T extends { scene: SceneRef }>(r: T): T => (r.scene.path === from ? { ...r, scene: { ...r.scene, path: to } } : r);
  return { ...file, layout, readings: file.readings.map(move), facts: file.facts.map(move) };
}

/** The note's body: a short explanation for a human who opens it, then the data. */
export function serializeStoryMapNote(file: StoryMapFile, project: string): string {
  return [
    "---",
    "creative-writer: false",
    `${STORY_MAP_FLAG}: ${STORY_MAP_VERSION}`,
    "---",
    `Story map data for **${project}**. Creative Writer rebuilds the map from your notes; this file only keeps what the model inferred (relationships, references, events and facts per scene) and where you pinned nodes by hand, plus the contradictions you dismissed in the story threads view, so all of it follows the project across devices. Relationships and threads you draw yourself live in your own notes, not here. Safe to sync, safe to delete — you would just re-run the readings and re-place pinned nodes.`,
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

function sceneOf(o: Record<string, unknown>): SceneRef | null {
  const scene = (o.scene && typeof o.scene === "object" ? o.scene : {}) as Record<string, unknown>;
  if (typeof scene.path !== "string") return null;
  return { path: scene.path, title: typeof scene.title === "string" ? scene.title : "", line: typeof scene.line === "number" ? scene.line : 0 };
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
