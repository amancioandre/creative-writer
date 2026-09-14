import { COLUMN_KINDS, parseColumnHeading, type ColumnKind } from "../threads/StoryThreadsNote";

const MAX_PROPOSALS = 8;
const MAX_TEXT = 200;

/** A thread the model thinks runs through the book: a kind, a name, one sentence, and the scenes that carry it. Nothing is written until the writer adds it. */
export interface ColumnProposal {
  readonly kind: ColumnKind;
  readonly name: string;
  readonly why: string;
  /** Scene titles from the list the model was given, in manuscript order. */
  readonly scenes: readonly string[];
  /** The heading the column would be written as. */
  readonly heading: string;
  /** Already a column, by heading or by name: shown greyed, never added twice. */
  readonly existing: boolean;
}

/** What the model is given: the events already read per scene, the cast, and the columns that exist. */
export interface ProposalBrief {
  readonly scenes: readonly { readonly title: string; readonly events: readonly string[] }[];
  readonly cast: readonly { readonly name: string; readonly kind: string }[];
  readonly existing: readonly string[];
}

/** The heading a proposal would be written as: the kind's prefix, and an arc's name linked so Obsidian keeps it current. */
export function proposalHeading(kind: ColumnKind, name: string): string {
  if (kind === "free") return name;
  const prefix = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  return kind === "arc" ? `${prefix}: [[${name}]]` : `${prefix}: ${name}`;
}

/**
 * Keeps at most eight proposals whose kind is one of the four, whose name
 * is not empty, and whose scenes were on the list; an arc must name a
 * character from the cast. A proposal that matches an existing column, by
 * heading or by name inside the kind, is kept and marked so the writer
 * sees the model and the grid agree.
 */
export function validateProposals(raw: unknown, brief: ProposalBrief): ColumnProposal[] {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const titles = new Map(brief.scenes.map((s, i) => [s.title.trim().toLowerCase(), { title: s.title, i }]));
  const cast = new Map(brief.cast.map((c) => [c.name.trim().toLowerCase(), c]));
  const existing = brief.existing.map((h) => parseColumnHeading(h));
  const out: ColumnProposal[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(r.columns) ? (r.columns as unknown[]) : []) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const kindWord = typeof o.kind === "string" ? o.kind.trim().toLowerCase() : "";
    const kind = (COLUMN_KINDS as readonly string[]).includes(kindWord) ? (kindWord as ColumnKind) : null;
    let name = typeof o.name === "string" ? o.name.trim().slice(0, MAX_TEXT).replace(/^\[\[|\]\]$/g, "") : "";
    const why = typeof o.why === "string" ? o.why.trim().slice(0, MAX_TEXT) : "";
    if (!kind || !name) continue;
    if (kind === "arc") { const c = cast.get(name.toLowerCase()); if (!c || c.kind !== "character") continue; name = c.name; }
    const scenes = (Array.isArray(o.scenes) ? (o.scenes as unknown[]) : []).filter((s): s is string => typeof s === "string").map((s) => titles.get(s.trim().toLowerCase())).filter((s): s is { title: string; i: number } => !!s);
    const ordered = [...new Map(scenes.map((s) => [s.i, s.title])).entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
    if (!ordered.length) continue;
    const heading = proposalHeading(kind, name);
    const key = heading.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const isExisting = existing.some((e) => e.heading.toLowerCase() === key || (e.kind === kind && e.name.toLowerCase() === name.toLowerCase()) || (kind !== "free" && e.kind === "free" && e.name.toLowerCase() === name.toLowerCase()));
    out.push({ kind, name, why, scenes: ordered, heading, existing: isExisting });
    if (out.length >= MAX_PROPOSALS) break;
  }
  // Arcs for the cast first, then themes, subplots, free: the order the grid draws them in.
  const order: Record<ColumnKind, number> = { arc: 0, theme: 1, subplot: 2, free: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
