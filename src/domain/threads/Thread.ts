import { EMPTY_ECHOES, type Echoes } from "../echoes/Echoes";
import type { EdgeSource, EntityKind, SceneRef } from "../story/StoryGraph";
import type { IntentReading } from "./Intent";

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
 * - `echo`: a phrase or a sentence that recurs across the book, found
 *   offline by the echo finder. Off by default; never red.
 */
export type ThreadKind = "entity" | "fact" | "writer" | "echo";

/**
 * What a stop is in a hand-drawn thread. A `plant` is a promise to the
 * reader, a `payoff` or `reversal` keeps it (the reversal being the case
 * where the later scene deliberately overturns the earlier one), a
 * `touch` is any other scene the thread passes through. A line with no
 * role is a touch, so every thread ever written is still a thread.
 */
export type StopRole = "plant" | "touch" | "payoff" | "reversal";
export const STOP_ROLES: readonly StopRole[] = ["plant", "touch", "payoff", "reversal"];

/** A stop's position inside its note, when its quote was found. */
export interface Anchor {
  /** 0-based line in the note. */
  readonly line: number;
  readonly ch: number;
}

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
  /** A hand-drawn stop's role; absent on entity and fact stops. */
  readonly role?: StopRole;
  /** The quote the writer anchored the stop with, as written. */
  readonly quote?: string;
  /** Where the quote was found in the note; null when it was written but no longer matches — a broken anchor. */
  readonly anchor?: Anchor | null;
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
  /** A hand-drawn thread with at least one plant: its plant → payoff arcs carry a direction. */
  readonly directed: boolean;
  /** Plants with no payoff or reversal after them — the promises the reader is still carrying. */
  readonly dangling: readonly ThreadRef[];
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
  /** The directed thread whose plant and reversal are these two scenes: the story means the change. Leaves the count without a dismissal. */
  readonly explainedBy?: string;
  /** The model's reading of what the difference means — a proposal for the card, nothing more. */
  readonly intent?: Pick<IntentReading, "verdict" | "reason" | "confidence" | "model">;
}

/** A contradiction the writer has neither dismissed nor explained as a reversal. */
export function isLiveContradiction(c: Contradiction): boolean {
  return !c.dismissed && !c.explainedBy;
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
  /** The echo finder's result, after the writer's motifs are taken out; the echo threads are drawn from it. */
  readonly echoes: Echoes;
  /** The semantic tier's state: pairs stored by the last reading, and how many of them no longer match their scenes. */
  readonly semantic: { readonly stored: number; readonly stale: number };
}

export const EMPTY_THREAD_MODEL: ThreadModel = { project: "", scenes: [], threads: [], contradictions: [], strips: [], factsRead: 0, echoes: EMPTY_ECHOES, semantic: { stored: 0, stale: 0 } };

/** Thread ids for the echo finder's findings, so a card can look the finding up. */
export const echoThreadId = (key: string): string => `echo:${key}`;
