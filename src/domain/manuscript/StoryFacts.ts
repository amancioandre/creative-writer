import type { EntityKind, StoryGraph } from "../story/StoryGraph";
import { isLiveContradiction, type Contradiction, type StopRole, type Thread } from "../threads/Thread";

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

export type GutterMarkKind = "conflict" | StopRole | "echo";

/**
 * A mark in the page's gutter that points at another place in the book:
 * a contradiction (on both scenes, each pointing at the other), a stop
 * of a directed thread the writer anchored to a sentence, pointing at
 * the stop that answers it, or an echo, pointing at the nearest other
 * place the same words occur.
 */
export interface GutterMark {
  readonly kind: GutterMarkKind;
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly otherPath: string;
  readonly otherLine: number;
}

/** @deprecated Use `GutterMark`; kept for the name's readers. */
export type ConflictMark = GutterMark;

export interface StoryFacts {
  readonly sections: ReadonlyMap<string, SectionFacts>;
  readonly marks: readonly GutterMark[];
}

export const EMPTY_FACTS: StoryFacts = { sections: new Map(), marks: [] };
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

/** Live contradictions as marks on both scenes, each pointing at the other. Dismissed and explained pairs are not marks. */
export function conflictMarks(contradictions: readonly Contradiction[]): GutterMark[] {
  const out: GutterMark[] = [];
  for (const c of contradictions) {
    if (!isLiveContradiction(c)) continue;
    const text = `${c.subject} · ${c.attribute}: ${c.a.value ?? c.a.note} vs ${c.b.value ?? c.b.note}`;
    out.push({ kind: "conflict", path: c.a.scene.path, line: c.a.scene.line, text, otherPath: c.b.scene.path, otherLine: c.b.scene.line });
    out.push({ kind: "conflict", path: c.b.scene.path, line: c.b.scene.line, text, otherPath: c.a.scene.path, otherLine: c.a.scene.line });
  }
  return out;
}

/**
 * The anchored stops of directed threads as marks at their sentence: a
 * plant points at the next payoff or reversal, a payoff or reversal
 * back at the plant before it. A plant with nothing keeping it points at
 * itself and says so. Stops without an anchor mark nothing — a heading
 * is too coarse a place for a promise.
 */
export function threadMarks(threads: readonly Thread[]): GutterMark[] {
  const out: GutterMark[] = [];
  const where = (r: { scene: { path: string; line: number }; anchor?: { line: number } | null }) => ({ path: r.scene.path, line: r.anchor?.line ?? r.scene.line });
  const name = (r: { scene: { path: string; title: string } }) => r.scene.title || r.scene.path.slice(r.scene.path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  for (const t of threads) {
    if (t.kind !== "writer" || !t.directed) continue;
    const stops = t.refs.filter((r) => r.index >= 0);
    for (const r of stops) {
      if (!r.anchor || !r.role || r.role === "touch") continue;
      const here = where(r);
      if (r.role === "plant") {
        const kept = stops.find((o) => (o.role === "payoff" || o.role === "reversal") && o.index > r.index);
        const other = kept ? where(kept) : here;
        out.push({ kind: "plant", ...here, text: kept ? `${t.label} · plant, ${kept.role === "reversal" ? "reversed" : "paid off"} in ${name(kept)}` : `${t.label} · plant, no payoff yet`, otherPath: other.path, otherLine: other.line });
      } else {
        const planted = [...stops].reverse().find((o) => o.role === "plant" && o.index < r.index);
        const other = planted ? where(planted) : here;
        out.push({ kind: r.role, ...here, text: planted ? `${t.label} · ${r.role}, planted in ${name(planted)}` : `${t.label} · ${r.role}, no plant before it`, otherPath: other.path, otherLine: other.line });
      }
    }
  }
  return out;
}

/** The echo finder's findings as marks at their sentence, each pointing at the nearest other occurrence. */
export function echoMarks(threads: readonly Thread[]): GutterMark[] {
  const out: GutterMark[] = [];
  const name = (r: { scene: { path: string; title: string } }) => r.scene.title || r.scene.path.slice(r.scene.path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  for (const t of threads) {
    if (t.kind !== "echo") continue;
    const stops = t.refs.filter((r) => r.index >= 0 && r.anchor);
    for (const r of stops) {
      const others = stops.filter((o) => o !== r);
      if (others.length === 0) continue;
      const nearest = others.reduce((best, o) => (Math.abs(o.index - r.index) < Math.abs(best.index - r.index) ? o : best));
      const where = nearest.index === r.index ? `again in ${name(nearest)}` : `also in ${name(nearest)}`;
      out.push({ kind: "echo", path: r.scene.path, line: r.anchor!.line, text: `“${r.quote ?? t.label}” · ${where}${others.length > 1 ? ` and ${others.length - 1} more` : ""}`, otherPath: nearest.scene.path, otherLine: nearest.anchor?.line ?? nearest.scene.line });
    }
  }
  return out;
}

const EASE_LEVELS = ["Very easy", "Easy", "Fairly easy", "Plain", "Fairly dense", "Dense", "Very dense"];

/** 1 (very easy) to 7 (very dense) from a readability band's label; 0 when unknown. */
export function easeLevel(label: string | null | undefined): number {
  return label ? EASE_LEVELS.indexOf(label) + 1 : 0;
}
