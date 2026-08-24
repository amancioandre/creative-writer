import { sceneKey, type EntityKind, type StoryGraph } from "../story/StoryGraph";
import type { StoryMapFile } from "../story/StoryMapFile";
import { factThreads } from "./Facts";
import { resolveThreadRef, type WriterThread } from "./StoryThreadsNote";
import { computeStrips } from "./Strips";
import type { SceneSlot, Thread, ThreadModel } from "./Thread";

export interface BuildThreadsOptions {
  /** An entity has to recur this often to be a thread at all. */
  readonly minEntityAppearances: number;
}

export const DEFAULT_THREADS_OPTIONS: BuildThreadsOptions = { minEntityAppearances: 2 };

const THREAD_ENTITY_KINDS: ReadonlySet<EntityKind> = new Set(["character", "location", "item", "faction", "event", "candidate"]);

/**
 * The threads model, pure and deterministic: the graph gives the axis and
 * the entity threads, the story map file the facts, the writer's note the
 * hand-drawn threads. `staleFacts` is which fact readings no longer match
 * their scene — the graph carries no prose, so the use case works that
 * out and passes it in.
 */
export function buildThreads(graph: StoryGraph, file: StoryMapFile, writer: readonly WriterThread[], staleFacts: ReadonlySet<string>, options: BuildThreadsOptions = DEFAULT_THREADS_OPTIONS): ThreadModel {
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
    threads.push({ id: `entity:${e.id}`, kind: "entity", source: "structure", label: e.name, entityId: e.id, entityKind: e.kind, refs, stale: false });
  }

  const facts = factThreads({ readings: file.facts, sceneIndex: indexOf, stale: staleFacts, dismissed: new Set(file.dismissed) });
  threads.push(...facts.threads);

  const places = scenes.map((s) => ({ scene: s.ref, index: s.index }));
  for (const t of writer) {
    const refs = t.items.map((item) => resolveThreadRef(item, places)).sort((a, b) => (a.index < 0 ? 1 : b.index < 0 ? -1 : a.index - b.index) || (a.line ?? 0) - (b.line ?? 0));
    threads.push({ id: `writer:${t.name.trim().toLowerCase()}`, kind: "writer", source: "writer", label: t.name, refs, stale: false });
  }

  const factsRead = file.facts.filter((r) => indexOf.has(sceneKey(r.scene))).length;
  return { project: graph.project, scenes, threads, contradictions: facts.contradictions, strips: computeStrips(scenes, graph.timeline, threads, facts.contradictions), factsRead };
}
