import { quoteAppears } from "../style/llm/validateFindings";
import { NameLookup, normalise } from "../story/EntityIndex";
import { sceneKey, type SceneRef } from "../story/StoryGraph";
import type { FactReading, ModelFact } from "../story/StoryMapFile";
import { isAccumulative, normAttr, normValue, valuesConflict } from "./Normalise";
import type { Contradiction, Thread, ThreadRef } from "./Thread";

const MAX_FACTS = 15;
const MAX_TEXT = 80;
const MAX_QUOTE = 400;

/**
 * A model's facts about a scene, kept only where they can be checked: the
 * subject must be a name actually in the scene, the evidence must be a
 * quote that is really there. Same discipline as `validateReading`.
 */
export function validateFacts(raw: unknown, text: string, present: readonly string[]): ModelFact[] {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const known = new NameLookup<string>();
  for (const n of present) known.add(n, n);
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const out: ModelFact[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(r.facts) ? (r.facts as unknown[]) : []) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const subject = typeof o.subject === "string" ? known.resolve(o.subject) : null;
    const attribute = str(o.attribute, MAX_TEXT), value = str(o.value, MAX_TEXT), evidence = str(o.evidence, MAX_QUOTE);
    if (!subject || !attribute || !value || !evidence || !quoteAppears(text, evidence)) continue;
    const key = `${normalise(subject)}|${normAttr(attribute)}|${normValue(value, attribute)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ subject, attribute, value, evidence });
    if (out.length >= MAX_FACTS) break;
  }
  return out;
}

/** `subject|attribute` — what a fact thread is about. */
export function factGroupKey(subject: string, attribute: string): string {
  return `${normalise(subject)}|${normAttr(attribute)}`;
}

/**
 * Stable across re-reads and re-orderings: the two stops are ordered by
 * scene key (a string), not by where they fall in the manuscript, and
 * values are compared normalised. The key only changes when the writer
 * edits one of the two scenes so that the value or the heading changes —
 * at which point a dismissed contradiction is legitimately new again.
 */
export function contradictionKey(subject: string, attribute: string, a: { scene: SceneRef; value: string }, b: { scene: SceneRef; value: string }): string {
  const [x, y] = sceneKey(a.scene) <= sceneKey(b.scene) ? [a, b] : [b, a];
  return `${factGroupKey(subject, attribute)}|${sceneKey(x.scene)}|${sceneKey(y.scene)}|${normValue(x.value, attribute)}|${normValue(y.value, attribute)}`;
}

export interface FactThreadsInput {
  readonly readings: readonly FactReading[];
  /** Scene key → position on the axis; readings of scenes not here are ignored (the scene is gone). */
  readonly sceneIndex: ReadonlyMap<string, number>;
  /** Scene keys whose prose changed since the reading. */
  readonly stale: ReadonlySet<string>;
  readonly dismissed: ReadonlySet<string>;
}

/**
 * Facts grouped by subject and attribute become threads; within a group,
 * every pair of scenes that disagree becomes a contradiction. A group
 * seen in one scene only is no thread — nothing to connect.
 */
export function factThreads(input: FactThreadsInput): { threads: Thread[]; contradictions: Contradiction[] } {
  type Stop = ThreadRef & { readonly value: string; readonly evidence: string; readonly key: string };
  const groups = new Map<string, { subject: string; attribute: string; stops: Stop[] }>();
  for (const reading of input.readings) {
    const key = sceneKey(reading.scene);
    const index = input.sceneIndex.get(key);
    if (index === undefined) continue;
    for (const f of reading.facts) {
      const gk = factGroupKey(f.subject, f.attribute);
      const g = groups.get(gk) ?? groups.set(gk, { subject: f.subject, attribute: f.attribute, stops: [] }).get(gk)!;
      g.stops.push({ scene: reading.scene, index, note: f.value, value: f.value, evidence: f.evidence, key });
    }
  }
  const threads: Thread[] = [];
  const contradictions: Contradiction[] = [];
  for (const [gk, g] of groups) {
    const scenes = new Set(g.stops.map((s) => s.key));
    if (scenes.size < 2) continue;
    const stops = [...g.stops].sort((a, b) => a.index - b.index || a.value.localeCompare(b.value));
    const id = `fact:${gk}`;
    const stale = stops.some((s) => input.stale.has(s.key));
    threads.push({ id, kind: "fact", source: "model", label: `${g.subject} · ${g.attribute}`, refs: stops.map(({ key: _k, ...ref }) => ref), stale });
    if (isAccumulative(g.attribute)) continue; // a list grows; it does not contradict itself
    const seen = new Set<string>();
    for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i]!, b = stops[j]!;
      if (a.key === b.key || !valuesConflict(a.value, b.value, g.attribute)) continue;
      const key = contradictionKey(g.subject, g.attribute, a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      const { key: _a, ...ra } = a; const { key: _b, ...rb } = b;
      contradictions.push({ key, threadId: id, subject: g.subject, attribute: g.attribute, a: ra, b: rb, dismissed: input.dismissed.has(key), stale: input.stale.has(a.key) || input.stale.has(b.key) });
    }
  }
  return { threads, contradictions };
}
