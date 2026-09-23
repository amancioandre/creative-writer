import { EMPTY_ECHOES, muteEchoes, type EchoStop, type Echoes } from "../echoes/Echoes";
import { sceneKey, type EntityKind, type StoryGraph } from "../story/StoryGraph";
import type { StoryMapFile } from "../story/StoryMapFile";
import { anchorQuote } from "./Anchors";
import { factThreads } from "./Facts";
import { resolveThreadRef, type WriterThread } from "./StoryThreadsNote";
import { computeStrips } from "./Strips";
import { echoThreadId, type Contradiction, type SceneSlot, type Thread, type ThreadModel, type ThreadRef } from "./Thread";

export interface BuildThreadsOptions {
  /** An entity has to recur this often to be a thread at all. */
  readonly minEntityAppearances: number;
}

export const DEFAULT_THREADS_OPTIONS: BuildThreadsOptions = { minEntityAppearances: 2 };

/** The raw Markdown of a project note, for anchoring a stop's quote; undefined when the text is not to hand. */
export type NoteText = (path: string) => string | undefined;
const NO_TEXT: NoteText = () => undefined;

const THREAD_ENTITY_KINDS: ReadonlySet<EntityKind> = new Set(["character", "location", "item", "faction", "event", "candidate"]);

/**
 * The threads model, pure and deterministic: the graph gives the axis and
 * the entity threads, the story map file the facts, the writer's note the
 * hand-drawn threads. `staleFacts` is which fact readings no longer match
 * their scene — the graph carries no prose, so the use case works that
 * out and passes it in. `textOf` gives a note's raw Markdown so a
 * hand-drawn stop's quote can be anchored to its line. `echoes` is the
 * echo finder's result for the same scenes; what the writer has quoted
 * in a thread is taken out of it here, because a quoted echo is a motif.
 */
export function buildThreads(graph: StoryGraph, file: StoryMapFile, writer: readonly WriterThread[], staleFacts: ReadonlySet<string>, options: BuildThreadsOptions = DEFAULT_THREADS_OPTIONS, textOf: NoteText = NO_TEXT, echoes: Echoes = EMPTY_ECHOES, semantic: { stored: number; stale: number } = { stored: 0, stale: 0 }): ThreadModel {
  let start = 0;
  const scenes: SceneSlot[] = graph.timeline.map((row, index) => {
    const slot = { ref: row.scene, index, words: row.words, start, note: row.scene.path, bookmarked: row.bookmarked };
    start += row.words;
    return slot;
  });
  const indexOf = new Map(scenes.map((s) => [sceneKey(s.ref), s.index]));

  const threads: Thread[] = [];
  for (const e of graph.entities) {
    if (!THREAD_ENTITY_KINDS.has(e.kind)) continue;
    const refs = e.appearances
      .map((scene) => ({ scene, index: indexOf.get(sceneKey(scene)) ?? -1, note: "" }))
      .filter((r) => r.index >= 0)
      .sort((a, b) => a.index - b.index);
    if (refs.length < options.minEntityAppearances) continue;
    threads.push({ id: `entity:${e.id}`, kind: "entity", source: "structure", label: e.name, entityId: e.id, entityKind: e.kind, refs, stale: false, directed: false, dangling: [] });
  }

  const facts = factThreads({ readings: file.facts, sceneIndex: indexOf, stale: staleFacts, dismissed: new Set(file.dismissed) });
  threads.push(...facts.threads);

  const places = scenes.map((s) => ({ scene: s.ref, index: s.index }));
  const nextLine = sceneEnds(graph);
  for (const t of writer) {
    const refs = t.items.map((item) => anchored(resolveThreadRef(item, places), textOf, nextLine)).sort((a, b) => (a.index < 0 ? 1 : b.index < 0 ? -1 : a.index - b.index) || (a.line ?? 0) - (b.line ?? 0));
    threads.push({ id: `writer:${t.name.trim().toLowerCase()}`, kind: "writer", source: "writer", label: t.name, refs, stale: false, directed: refs.some((r) => r.role === "plant"), dangling: danglingPlants(refs), ...(t.scale ? { scale: t.scale } : {}) });
  }

  const intents = new Map(file.intents.map((r) => [r.key, r]));
  const contradictions = facts.contradictions.map((c) => explain(c, threads)).map((c) => { const r = intents.get(c.key); return r ? { ...c, intent: { verdict: r.verdict, reason: r.reason, confidence: r.confidence, model: r.model } } : c; });

  const kept = muteEchoes(echoes, writer.flatMap((t) => t.items.map((i) => i.quote)).filter((q): q is string => !!q));
  const echoRef = (s: EchoStop, note: string): ThreadRef => anchored({ scene: s.scene, index: indexOf.get(sceneKey(s.scene)) ?? s.index, note, quote: s.text }, textOf, nextLine);
  for (const g of kept.groups) {
    threads.push({ id: echoThreadId(g.key), kind: "echo", source: "extracted", label: g.text, refs: g.stops.map((s) => echoRef(s, s.sentence)), stale: false, directed: false, dangling: [] });
  }
  for (const p of kept.pairs) {
    threads.push({ id: echoThreadId(p.key), kind: "echo", source: "extracted", label: opening(p.a.sentence), refs: [echoRef(p.a, p.a.sentence), echoRef(p.b, p.b.sentence)], stale: false, directed: false, dangling: [] });
  }

  const factsRead = file.facts.filter((r) => indexOf.has(sceneKey(r.scene))).length;
  return { project: graph.project, scenes, threads, contradictions, strips: computeStrips(scenes, graph.timeline, threads, contradictions), factsRead, echoes: kept, semantic };
}

/** The first words of a sentence, as a label. */
function opening(sentence: string): string {
  const words = sentence.trim().split(/\s+/);
  return words.length <= 7 ? sentence.trim() : `${words.slice(0, 7).join(" ")}…`;
}

/** Where each scene ends: the line of the next heading in the same note, or -1 for the note's last scene. */
function sceneEnds(graph: StoryGraph): Map<string, number> {
  const byNote = new Map<string, number[]>();
  for (const row of graph.timeline) (byNote.get(row.scene.path) ?? byNote.set(row.scene.path, []).get(row.scene.path)!).push(row.scene.line);
  const out = new Map<string, number>();
  for (const row of graph.timeline) {
    const lines = byNote.get(row.scene.path)!.filter((l) => l > row.scene.line);
    out.set(sceneKey(row.scene), lines.length ? Math.min(...lines) : -1);
  }
  return out;
}

/** A resolved stop with a quote gets its anchor looked up; a quote that no longer matches leaves `anchor: null`, visibly broken. */
function anchored(ref: ThreadRef, textOf: NoteText, nextLine: ReadonlyMap<string, number>): ThreadRef {
  if (ref.index < 0 || !ref.quote) return ref;
  const text = textOf(ref.scene.path);
  if (text === undefined) return ref;
  return { ...ref, anchor: anchorQuote(text, ref.scene.line, nextLine.get(sceneKey(ref.scene)) ?? -1, ref.quote) };
}

/**
 * A contradiction whose two scenes are the plant and the reversal of a
 * directed thread is one the story means: the writer said so by drawing
 * the thread (or accepting the model's reading of it). Scene pair only —
 * the model's quote and the writer's rarely match word for word.
 */
function explain(c: Contradiction, threads: readonly Thread[]): Contradiction {
  const lo = Math.min(c.a.index, c.b.index), hi = Math.max(c.a.index, c.b.index);
  const by = threads.find((t) => t.kind === "writer" && t.directed && t.refs.some((r) => r.role === "plant" && r.index === lo) && t.refs.some((r) => r.role === "reversal" && r.index === hi));
  return by ? { ...c, explainedBy: by.id } : c;
}

/** Plants with no payoff or reversal at a later stop. */
export function danglingPlants(refs: readonly ThreadRef[]): ThreadRef[] {
  return refs.filter((r) => r.role === "plant" && r.index >= 0 && !refs.some((o) => (o.role === "payoff" || o.role === "reversal") && o.index > r.index));
}
