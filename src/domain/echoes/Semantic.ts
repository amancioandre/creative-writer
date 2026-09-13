import type { SceneRef } from "../story/StoryGraph";
import { proximity, type EchoOptions, type EchoPair, type EchoStop } from "./Echoes";

/**
 * The semantic tier: two sentences that say the same thing in unrelated
 * words, found by comparing sentence embeddings from a local model. The
 * vectors are never persisted — only the pairs found above the
 * threshold, with the hash of each scene's prose when it was read, so a
 * pair goes stale with its scene the way a fact reading does.
 */
export interface SemanticEcho {
  readonly a: SceneRef;
  readonly b: SceneRef;
  readonly hashA: string;
  readonly hashB: string;
  readonly quoteA: string;
  readonly quoteB: string;
  /** Cosine between the two vectors. */
  readonly score: number;
  readonly model: string;
}

/** A sentence to embed: where it is and its words. */
export interface EmbeddingCandidate {
  readonly scene: SceneRef;
  readonly index: number;
  readonly paragraph: number;
  readonly text: string;
}

/** Cosine at or above which two embedded sentences echo; embedding models score paraphrases high and unrelated prose in the middle. */
export const SEMANTIC_MIN_COSINE = 0.88;
/** Fewest words for a sentence to be embedded — short sentences embed alike whatever they say. */
export const SEMANTIC_MIN_WORDS = 8;
/** Random hyperplanes for the bucketing; more planes, fewer comparisons, more misses. */
const PLANES = 10;
/** Most pairs kept per run. */
const MAX_SEMANTIC_PAIRS = 200;

/** Unit vectors, so a dot product is a cosine. */
export function normalise(v: readonly number[]): Float64Array {
  const out = new Float64Array(v.length);
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

/** Deterministic pseudo-random hyperplanes, the same on every machine so the same prose buckets the same way. */
function planes(dims: number): Float64Array[] {
  let seed = 2166136261;
  const rnd = () => { seed = (Math.imul(seed, 16807) + 12345) >>> 0; return seed / 4294967296 - 0.5; };
  return Array.from({ length: PLANES }, () => { const p = new Float64Array(dims); for (let i = 0; i < dims; i++) p[i] = rnd(); return p; });
}

function bucketOf(v: Float64Array, ps: readonly Float64Array[]): number {
  let b = 0;
  ps.forEach((p, i) => { if (dot(v, p) >= 0) b |= 1 << i; });
  return b;
}

/**
 * Pairs above the threshold, from different paragraphs, compared only
 * within the same or a neighbouring hash bucket (one bit apart) so a
 * novel's thousands of sentences are not all compared with each other.
 * Deterministic for the same vectors.
 */
export function pairEmbeddings(candidates: readonly EmbeddingCandidate[], vectors: readonly (readonly number[])[], hashOf: (scene: SceneRef) => string, model: string, minCosine = SEMANTIC_MIN_COSINE): SemanticEcho[] {
  if (candidates.length !== vectors.length || candidates.length < 2) return [];
  const unit = vectors.map(normalise);
  const ps = planes(unit[0]!.length);
  const buckets = new Map<number, number[]>();
  unit.forEach((v, i) => { const b = bucketOf(v, ps); (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(i); });
  const out: SemanticEcho[] = [];
  const seen = new Set<string>();
  const consider = (i: number, j: number) => {
    const [x, y] = i < j ? [i, j] : [j, i];
    const id = `${x}:${y}`;
    if (seen.has(id)) return;
    seen.add(id);
    const a = candidates[x]!, b = candidates[y]!;
    if (a.index === b.index && a.paragraph === b.paragraph) return;
    const score = dot(unit[x]!, unit[y]!);
    if (score < minCosine) return;
    const [p, q] = a.index < b.index || (a.index === b.index && a.paragraph <= b.paragraph) ? [a, b] : [b, a];
    out.push({ a: p.scene, b: q.scene, hashA: hashOf(p.scene), hashB: hashOf(q.scene), quoteA: p.text, quoteB: q.text, score: Math.round(score * 1000) / 1000, model });
  };
  for (const [b, members] of buckets) {
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) consider(members[i]!, members[j]!);
    for (let bit = 0; bit < PLANES; bit++) {
      const other = buckets.get(b ^ (1 << bit));
      if (!other) continue;
      for (const i of members) for (const j of other) consider(i, j);
    }
  }
  return out.sort((p, q) => q.score - p.score || p.quoteA.localeCompare(q.quoteA)).slice(0, MAX_SEMANTIC_PAIRS);
}

/**
 * Stored pairs back into the echo finder's shape: a pair whose scene is
 * gone or whose prose changed since the reading is stale and left out
 * (counted, so the panel can say "read again").
 */
export function semanticEchoPairs(stored: readonly SemanticEcho[], sceneIndex: ReadonlyMap<string, number>, currentHash: ReadonlyMap<string, string>, options: Pick<EchoOptions, "proximityFloor" | "horizon">): { pairs: EchoPair[]; stale: number } {
  const key = (s: SceneRef) => `${s.path}#${s.title}`;
  const pairs: EchoPair[] = [];
  let stale = 0;
  for (const e of stored) {
    const ia = sceneIndex.get(key(e.a)), ib = sceneIndex.get(key(e.b));
    if (ia === undefined || ib === undefined || currentHash.get(key(e.a)) !== e.hashA || currentHash.get(key(e.b)) !== e.hashB) { stale++; continue; }
    const stop = (scene: SceneRef, index: number, text: string): EchoStop => ({ scene, index, paragraph: -1, from: 0, to: 0, text, sentence: text });
    const [a, b] = ia <= ib ? [stop(e.a, ia, e.quoteA), stop(e.b, ib, e.quoteB)] : [stop(e.b, ib, e.quoteB), stop(e.a, ia, e.quoteA)];
    const distance = b.index - a.index;
    pairs.push({ key: `semantic:${key(e.a)}|${key(e.b)}|${e.quoteA.length}:${e.quoteB.length}`, tier: "semantic", a, b, similarity: e.score, score: Math.round(e.score * proximity(distance, options) * 1000) / 1000, distance });
  }
  return { pairs, stale };
}
