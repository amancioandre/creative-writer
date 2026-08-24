import type { EdgeSource, EntityKind, SceneRef } from "../story/StoryGraph";

/**
 * Story threads: the things that recur across scenes and can therefore
 * break between them. A thread is a name and the scenes it touches; the
 * threads view draws an arc between each consecutive pair, so a clue
 * planted in chapter three and paid off in chapter forty is one long arc
 * and a fact that changes on the way is a red one.
 *
 * Three sources, three levels of trust:
 * - `entity`: where a character, place or thing is mentioned. Free,
 *   deterministic, from the story graph.
 * - `fact`: a concrete fact a model extracted per scene (eye colour,
 *   age, who knows what). Contradictions between facts are found by code,
 *   never by the model.
 * - `writer`: threads drawn by hand in `Story threads.md`.
 */
export type ThreadKind = "entity" | "fact" | "writer";

export interface ThreadRef {
  readonly scene: SceneRef;
  /** Position on the manuscript axis; -1 when the scene could not be found. */
  readonly index: number;
  /** What this stop says: the writer's note, or a fact's value. */
  readonly note: string;
  readonly value?: string;
  readonly evidence?: string;
  /** A writer's link that resolved to no scene — kept so the broken link is visible, not silently dropped. */
  readonly unresolved?: string;
  /** 0-based line of the writer's list item. */
  readonly line?: number;
}

export interface Thread {
  readonly id: string;
  readonly kind: ThreadKind;
  readonly source: EdgeSource;
  readonly label: string;
  readonly entityId?: string;
  readonly entityKind?: EntityKind;
  /** In manuscript order; unresolved refs last. */
  readonly refs: readonly ThreadRef[];
  /** Some scene changed since the model read it. */
  readonly stale: boolean;
}

/** Two scenes state a different value for the same fact. */
export interface Contradiction {
  readonly key: string;
  readonly threadId: string;
  readonly subject: string;
  readonly attribute: string;
  readonly a: ThreadRef;
  readonly b: ThreadRef;
  readonly dismissed: boolean;
  readonly stale: boolean;
}

/** One scene on the axis. */
export interface SceneSlot {
  readonly ref: SceneRef;
  readonly index: number;
  readonly words: number;
  /** Words before this scene — the x-scale is cumulative length, so long scenes are wide. */
  readonly start: number;
  /** The note the scene is in. */
  readonly note: string;
  readonly bookmarked: boolean;
}

/** A per-scene metric drawn under the axis; one value per scene. */
export interface Strip {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly values: readonly number[];
  readonly higherIsBetter?: boolean;
}

export interface ThreadModel {
  readonly project: string;
  readonly scenes: readonly SceneSlot[];
  readonly threads: readonly Thread[];
  readonly contradictions: readonly Contradiction[];
  readonly strips: readonly Strip[];
  /** Scenes with a facts reading, so the view can tell "nothing found" from "never read". */
  readonly factsRead: number;
}

export const EMPTY_THREAD_MODEL: ThreadModel = { project: "", scenes: [], threads: [], contradictions: [], strips: [], factsRead: 0 };
