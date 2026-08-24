import { quoteAppears } from "../style/llm/validateFindings";
import { NameLookup } from "./EntityIndex";
import type { ModelEvent, ModelReference, ModelRelation } from "./StoryMapFile";

const MAX_ITEMS = 12;
const MAX_TEXT = 400;

export interface ValidatedReading {
  readonly relations: ModelRelation[];
  readonly references: ModelReference[];
  readonly events: ModelEvent[];
}

/**
 * A model's reading of a scene, kept only where it can be checked: every
 * relation must join two names that are actually present in the scene,
 * every claim must quote the passage. A hallucinated cousin does not get
 * a node.
 */
export function validateReading(raw: unknown, text: string, present: readonly string[]): ValidatedReading {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const known = new NameLookup<string>();
  for (const n of present) known.add(n, n);
  const canon = (v: unknown): string | null => (typeof v === "string" ? known.resolve(v) : null);
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");
  const quoted = (v: unknown) => { const q = str(v); return q && quoteAppears(text, q) ? q : ""; };
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as unknown[]).map((x) => (x && typeof x === "object" ? x : {}) as Record<string, unknown>) : []);

  const relations: ModelRelation[] = [];
  const seen = new Set<string>();
  for (const o of list(r.relations)) {
    const from = canon(o.from), to = canon(o.to), evidence = quoted(o.evidence), label = str(o.label);
    if (!from || !to || from === to || !evidence || !label) continue;
    const key = [from, to].sort().join("|") + "|" + label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push({ from, to, label, evidence });
    if (relations.length >= MAX_ITEMS) break;
  }

  const references: ModelReference[] = [];
  for (const o of list(r.references)) {
    const name = str(o.name), evidence = quoted(o.evidence);
    if (!name || !evidence) continue;
    const kind = o.kind;
    references.push({ name, kind: kind === "myth" || kind === "history" || kind === "literature" || kind === "scripture" ? kind : "other", about: canon(o.about) ?? "", note: str(o.note), evidence });
    if (references.length >= MAX_ITEMS) break;
  }

  const events: ModelEvent[] = [];
  for (const o of list(r.events)) {
    const summary = str(o.summary), evidence = quoted(o.evidence);
    if (!summary || !evidence) continue;
    const participants = (Array.isArray(o.participants) ? (o.participants as unknown[]) : []).map(canon).filter((p): p is string => p !== null);
    events.push({ summary, participants: [...new Set(participants)], evidence });
    if (events.length >= MAX_ITEMS) break;
  }
  return { relations, references, events };
}
