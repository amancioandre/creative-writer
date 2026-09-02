import type { Day } from "../progress/Dates";
import type { ProjectSpec } from "../progress/Project";
import type { Board, Card } from "./Board";

/**
 * The stories row: every declared project as a card with a stage, the
 * ideas that have no project yet, and the folders that look like stories
 * but declare nothing. Stages the writer sets live in the project note's
 * front matter; the two that can be inferred are, unless the note says
 * otherwise.
 */
export const STAGES = ["idea", "development", "drafting", "revising", "finished", "shelved"] as const;
export type Stage = (typeof STAGES)[number];
/** The stages a project note may declare; `idea` is the state of a card without a folder. */
export const SETTABLE_STAGES: readonly Stage[] = ["development", "drafting", "revising", "finished", "shelved"];
export const STAGE_LABEL: Record<Stage, string> = { idea: "Idea", development: "In development", drafting: "Drafting", revising: "Revising", finished: "Finished", shelved: "Shelved" };

export function parseStage(v: unknown): Stage | null {
  return typeof v === "string" && (SETTABLE_STAGES as readonly string[]).includes(v.trim().toLowerCase()) ? (v.trim().toLowerCase() as Stage) : null;
}

/** A declared stage wins; otherwise finished once the target is met, drafting once prose exists, in development before. */
export function inferStage(declared: Stage | null, hasProse: boolean, words: number, target: number): Stage {
  if (declared) return declared;
  if (target > 0 && words >= target) return "finished";
  return hasProse ? "drafting" : "development";
}

/** `"[[Note#Heading|shown]]"` as written in front matter, to the link target `Note`; null for anything else. */
export function linkTarget(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^\s*\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]\s*$/.exec(v);
  return m ? m[1]!.trim() : v.trim() || null;
}

/** What the use case gathers about one project before it becomes a card. */
export interface StoryFacts {
  readonly spec: ProjectSpec;
  /** The project note's front matter. */
  readonly frontmatter: Record<string, unknown>;
  readonly words: number;
  readonly hasProse: boolean;
  /** Character notes. */
  readonly cast: number;
  readonly lastWorked: Day | null;
  /** Resolved path of the `writing-idea` link, if any. */
  readonly idea: string | null;
  /** Resolved path of the `writing-voice` link, if any. */
  readonly voice: string | null;
}

export interface StoryCard {
  readonly spec: ProjectSpec;
  readonly stage: Stage;
  /** Whether the stage was written by the writer rather than inferred. */
  readonly declared: boolean;
  readonly premise: string;
  readonly idea: string | null;
  readonly voice: string | null;
  readonly words: number;
  readonly target: number;
  readonly cast: number;
  readonly lastWorked: Day | null;
}

export function storyCard(facts: StoryFacts): StoryCard {
  const declared = parseStage(facts.frontmatter["writing-stage"]);
  const premise = typeof facts.frontmatter["writing-premise"] === "string" ? facts.frontmatter["writing-premise"].trim() : "";
  return {
    spec: facts.spec,
    stage: inferStage(declared, facts.hasProse, facts.words, facts.spec.targetWords),
    declared: declared !== null,
    premise,
    idea: facts.idea,
    voice: facts.voice,
    words: facts.words,
    target: facts.spec.targetWords,
    cast: facts.cast,
    lastWorked: facts.lastWorked,
  };
}

export interface StoriesRow {
  readonly stories: readonly StoryCard[];
  /** Premise cards that no project claims and that claim no project. */
  readonly ideas: readonly Card[];
  /** Folders under the stories folder with prose and no declaration. */
  readonly unfiled: readonly string[];
}

/** The premise cards still without a home: not linked to a project by `writer-story`, and not claimed by any project's `writing-idea`. */
export function ideasOf(board: Board, stories: readonly StoryCard[]): Card[] {
  const claimed = new Set(stories.map((s) => s.idea).filter((p): p is string => p !== null));
  const notePaths = new Set(stories.map((s) => s.spec.notePath));
  return board.cards.filter((c) => c.groups.includes("premise") && !claimed.has(c.path) && !(c.story && notePaths.has(c.story)));
}

export const EMPTY_STORIES: StoriesRow = { stories: [], ideas: [], unfiled: [] };
