import type { EntityIndex } from "../../domain/story/EntityIndex";
import { findMentions } from "../../domain/story/Mentions";
import { sceneKey, type SceneRef, type StoryGraph } from "../../domain/story/StoryGraph";

/**
 * The names a model may use for one scene: everything the graph saw
 * there (so candidates and aliases count), or, for a scene the graph has
 * no row for, whatever the mention scan finds. Sorted, so prompts are
 * stable and readings cache well.
 */
export function presentNames(graph: StoryGraph, ref: SceneRef, prose: string, index: EntityIndex): string[] {
  const known = graph.entities.filter((e) => e.kind !== "note" && e.kind !== "reference");
  const byId = new Map(known.map((e) => [e.id, e.name]));
  const row = graph.timeline.find((t) => sceneKey(t.scene) === sceneKey(ref));
  const present = row ? row.present.map((id) => byId.get(id)).filter((n): n is string => !!n) : [];
  if (present.length === 0) for (const m of findMentions(prose, index)) if (m.entityId && byId.has(m.entityId)) present.push(byId.get(m.entityId)!);
  return [...new Set(present)].sort((a, b) => a.localeCompare(b));
}
