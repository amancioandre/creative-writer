import type { Edge, EntityKind, Layer, StoryGraph } from "./StoryGraph";

export interface GraphFilter {
  readonly layers: ReadonlySet<Layer>;
  readonly kinds: ReadonlySet<EntityKind>;
  /** Case-insensitive substring on entity names; "" for all. */
  readonly query: string;
  /** Hide entities that end up with no edges under the current filter. */
  readonly hideIsolated: boolean;
  /** Show only this entity and its direct neighbours. */
  readonly focusId?: string | null;
}

export const ALL_LAYERS: readonly Layer[] = ["explicit", "internal", "external"];
export const ALL_KINDS: readonly EntityKind[] = ["character", "location", "item", "faction", "event", "note", "candidate", "reference"];

export const DEFAULT_FILTER: GraphFilter = {
  layers: new Set(ALL_LAYERS),
  kinds: new Set(ALL_KINDS.filter((k) => k !== "note")),
  query: "",
  hideIsolated: false,
};

/** The subgraph a view shows. Edges to hidden nodes go with them. */
export function applyFilter(graph: StoryGraph, filter: GraphFilter): StoryGraph {
  const q = filter.query.trim().toLowerCase();
  let entities = graph.entities.filter((e) => filter.kinds.has(e.kind));
  if (q) {
    const hits = new Set(entities.filter((e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))).map((e) => e.id));
    // Keep the direct neighbours of matches so the search shows a person in context.
    const keep = new Set(hits);
    for (const edge of graph.edges) {
      if (hits.has(edge.from)) keep.add(edge.to);
      if (hits.has(edge.to)) keep.add(edge.from);
    }
    entities = entities.filter((e) => keep.has(e.id));
  }
  if (filter.focusId) {
    const ring = new Set([filter.focusId]);
    for (const edge of graph.edges) {
      if (!filter.layers.has(edge.layer)) continue;
      if (edge.from === filter.focusId) ring.add(edge.to);
      if (edge.to === filter.focusId) ring.add(edge.from);
    }
    entities = graph.entities.filter((e) => ring.has(e.id));
  }
  let ids = new Set(entities.map((e) => e.id));
  const keep = (e: Edge) => filter.layers.has(e.layer) && ids.has(e.from) && ids.has(e.to);
  let edges = graph.edges.filter(keep);
  if (filter.hideIsolated) {
    const linked = new Set<string>();
    for (const e of edges) { linked.add(e.from); linked.add(e.to); }
    entities = entities.filter((e) => linked.has(e.id));
    ids = new Set(entities.map((e) => e.id));
    edges = edges.filter(keep);
  }
  return { ...graph, entities, edges };
}

/** Edges touching an entity, strongest first. */
export function neighbours(graph: StoryGraph, id: string): Edge[] {
  return graph.edges.filter((e) => e.from === id || e.to === id).sort((a, b) => b.weight - a.weight);
}
