import type { EntityKind, StoryGraph } from "../story/StoryGraph";
import type { Contradiction } from "../threads/Thread";

/**
 * What the rest of the plugin knows about each section of the manuscript,
 * folded onto the page: how it reads, what changed today, who is in it,
 * and where the model saw two scenes disagree. All of it is computed
 * elsewhere already; this only shapes it for the page.
 */
export interface CastMember {
  readonly name: string;
  readonly kind: EntityKind;
  readonly path: string | null;
  readonly mentions: number;
}

export interface SceneCast {
  /** 0-based line of the scene's heading; 0 for prose before the first heading. */
  readonly line: number;
  readonly title: string;
  readonly cast: readonly CastMember[];
}

export interface SectionFacts {
  readonly readability: { readonly label: string; readonly score: number } | null;
  readonly today: { readonly added: number; readonly removed: number };
  /** Everyone in the section, most mentioned first. */
  readonly cast: readonly CastMember[];
  readonly scenes: readonly SceneCast[];
}

/** Two scenes the model read differently on the same point: marked on both. */
export interface ConflictMark {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly otherPath: string;
  readonly otherLine: number;
}

export interface StoryFacts {
  readonly sections: ReadonlyMap<string, SectionFacts>;
  readonly conflicts: readonly ConflictMark[];
}

export const EMPTY_FACTS: StoryFacts = { sections: new Map(), conflicts: [] };
export const NO_SECTION: SectionFacts = { readability: null, today: { added: 0, removed: 0 }, cast: [], scenes: [] };

const CAST_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>(["character", "location", "item", "faction", "event", "candidate"]);

/** Who is in each note and each of its scenes, from the map's timeline. */
export function castFromGraph(graph: StoryGraph): Map<string, { cast: CastMember[]; scenes: SceneCast[] }> {
  const byId = new Map(graph.entities.map((e) => [e.id, e]));
  const out = new Map<string, { cast: CastMember[]; scenes: SceneCast[] }>();
  for (const row of graph.timeline) {
    const entry = out.get(row.scene.path) ?? { cast: [], scenes: [] };
    const members: CastMember[] = [];
    for (const id of row.present) {
      const e = byId.get(id);
      if (!e || !CAST_KINDS.has(e.kind)) continue;
      const m = { name: e.name, kind: e.kind, path: e.path, mentions: e.mentions };
      members.push(m);
      if (!entry.cast.some((c) => c.name === m.name)) entry.cast.push(m);
    }
    entry.scenes.push({ line: row.scene.line, title: row.scene.title, cast: members.sort(byMentions) });
    out.set(row.scene.path, entry);
  }
  for (const entry of out.values()) entry.cast.sort(byMentions);
  return out;
}

function byMentions(a: CastMember, b: CastMember): number {
  return kindOrder(a.kind) - kindOrder(b.kind) || b.mentions - a.mentions || a.name.localeCompare(b.name);
}

const KIND_ORDER: Record<EntityKind, number> = { character: 0, candidate: 1, faction: 2, location: 3, item: 4, event: 5, note: 6, reference: 7 };
function kindOrder(k: EntityKind): number { return KIND_ORDER[k]; }

/** Live contradictions as marks on both scenes, each pointing at the other. */
export function conflictMarks(contradictions: readonly Contradiction[]): ConflictMark[] {
  const out: ConflictMark[] = [];
  for (const c of contradictions) {
    if (c.dismissed) continue;
    const text = `${c.subject} · ${c.attribute}: ${c.a.value ?? c.a.note} vs ${c.b.value ?? c.b.note}`;
    out.push({ path: c.a.scene.path, line: c.a.scene.line, text, otherPath: c.b.scene.path, otherLine: c.b.scene.line });
    out.push({ path: c.b.scene.path, line: c.b.scene.line, text, otherPath: c.a.scene.path, otherLine: c.a.scene.line });
  }
  return out;
}

const EASE_LEVELS = ["Very easy", "Easy", "Fairly easy", "Plain", "Fairly dense", "Dense", "Very dense"];

/** 1 (very easy) to 7 (very dense) from a readability band's label; 0 when unknown. */
export function easeLevel(label: string | null | undefined): number {
  return label ? EASE_LEVELS.indexOf(label) + 1 : 0;
}
