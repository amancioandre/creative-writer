import type { Sentence } from "../rhythm/Sentence";
import type { SceneRef } from "../story/StoryGraph";
import { STOPWORDS } from "../style/lexicon/stopwords";
import { stem } from "../style/rules/RepetitionRule";
import { looksLikeName, tokenize, type Token } from "../style/Tokenizer";

/**
 * Echoes: two places in a project that say nearly the same thing. The
 * repetition rule hears a word twice in one paragraph; what nobody hears
 * is the phrase reached for every time a character is tired, the image
 * used in chapter three and again in chapter eleven, the sentence
 * rewritten in slightly different words two scenes later. This module
 * finds those pairs across the whole manuscript, offline, in two tiers:
 *
 * - `surface`: a run of stemmed words that recurs in different
 *   paragraphs, reported whole. Names and dialogue tags never make one.
 * - `lexical`: two sentences whose bags of stemmed content words are
 *   close (cosine over tf-idf), in different paragraphs.
 *
 * A third tier, `semantic`, comes from a local model on command and
 * merges into the same shapes. The unit is always the pair: both ends,
 * both positions, a score. Distance works the other way round from a
 * fact: a pair two scenes apart grates, a pair three hundred pages
 * apart is invisible, so nearness raises the score and the card says
 * whether it is a tic (close) or a habit (spread over the book).
 */
export type EchoTier = "surface" | "lexical" | "semantic";

/** How a scene comes in: its prose with markup stripped and its sentences, offsets relative to the prose. */
export interface EchoScene {
  readonly ref: SceneRef;
  /** Position on the manuscript axis. */
  readonly index: number;
  readonly prose: string;
  readonly sentences: readonly Sentence[];
}

export interface EchoStop {
  readonly scene: SceneRef;
  readonly index: number;
  /** Paragraph number inside the scene's prose (paragraphs are separated by a blank line). */
  readonly paragraph: number;
  /** Offsets into the scene's prose. */
  readonly from: number;
  readonly to: number;
  /** The words as written here. */
  readonly text: string;
  /** The sentence the words sit in, for the card. */
  readonly sentence: string;
}

/** Two sentences that resemble each other. */
export interface EchoPair {
  readonly key: string;
  readonly tier: EchoTier;
  readonly a: EchoStop;
  readonly b: EchoStop;
  /** 0..1, how alike the two are. */
  readonly similarity: number;
  /** Similarity weighted by nearness: the number to rank by. */
  readonly score: number;
  /** Scenes apart. */
  readonly distance: number;
}

/** A phrase that recurs; its occurrences in manuscript order. */
export interface EchoGroup {
  readonly key: string;
  readonly tier: "surface";
  /** The phrase as first written. */
  readonly text: string;
  readonly stops: readonly EchoStop[];
  /** Distinct scenes the phrase appears in. */
  readonly scenes: number;
  /** Fewest scenes between two consecutive occurrences: 0 when a scene holds two. */
  readonly nearest: number;
  readonly score: number;
}

export interface Echoes {
  readonly groups: readonly EchoGroup[];
  readonly pairs: readonly EchoPair[];
}

export const EMPTY_ECHOES: Echoes = { groups: [], pairs: [] };

export interface EchoOptions {
  /** Shortest run of words that can seed a phrase echo; the phrase grows from there for as long as the occurrences agree. */
  readonly minGram: number;
  /** A sentence needs this many content words to be compared with another. */
  readonly minContentWords: number;
  /** Cosine at or above which two sentences echo. */
  readonly minCosine: number;
  /** Nearness never falls below this, so a habit spread over the whole book still ranks. */
  readonly proximityFloor: number;
  /** Scenes over which nearness decays to the floor. */
  readonly horizon: number;
  /** Lowercase words that are names: never part of an echo. */
  readonly names: ReadonlySet<string>;
  /** Most pairs kept, best first. */
  readonly maxPairs: number;
}

/** One choice in the settings, three presets: how many echoes the writer wants to hear about. */
export type EchoSensitivity = "low" | "medium" | "high";
export const ECHO_SENSITIVITIES: readonly EchoSensitivity[] = ["low", "medium", "high"];

const BASE: Omit<EchoOptions, "names"> = { minGram: 3, minContentWords: 6, minCosine: 0.6, proximityFloor: 0.35, horizon: 4, maxPairs: 400 };

export const ECHO_PRESETS: Readonly<Record<EchoSensitivity, Omit<EchoOptions, "names">>> = {
  low: { ...BASE, minGram: 4, minContentWords: 8, minCosine: 0.75 },
  medium: BASE,
  high: { ...BASE, minGram: 3, minContentWords: 5, minCosine: 0.5 },
};

export function echoOptions(sensitivity: EchoSensitivity, names: ReadonlySet<string> = new Set()): EchoOptions {
  return { ...ECHO_PRESETS[sensitivity], names };
}

export const DEFAULT_ECHO_OPTIONS: EchoOptions = echoOptions("medium");

/** Nearness: 1 for the same scene, decaying to the floor over the horizon. Near is worse. */
export function proximity(distance: number, o: Pick<EchoOptions, "proximityFloor" | "horizon">): number {
  return o.proximityFloor + (1 - o.proximityFloor) * Math.exp(-distance / Math.max(1, o.horizon));
}

/** A tic is heard within a couple of scenes; a habit is spread over the book. */
export function echoVerdict(g: Pick<EchoGroup, "scenes" | "nearest">): "tic" | "habit" | "echo" {
  if (g.scenes >= 3) return "habit";
  if (g.nearest <= 2) return "tic";
  return "echo";
}

// --- tokens ------------------------------------------------------------------

interface Word {
  readonly tok: Token;
  readonly stem: string;
  readonly content: boolean;
  readonly name: boolean;
  readonly paragraph: number;
  readonly sentence: number;
}

/** Tokens with what the echo finder needs to know about each. */
function words(scene: EchoScene, names: ReadonlySet<string>): Word[] {
  const breaks = paragraphBreaks(scene.prose);
  const out: Word[] = [];
  let p = 0, s = 0;
  for (const tok of tokenize(scene.prose)) {
    while (p < breaks.length && breaks[p]! <= tok.from) p++;
    while (s + 1 < scene.sentences.length && scene.sentences[s + 1]!.from <= tok.from) s++;
    const name = looksLikeName(scene.prose, tok) || names.has(tok.text);
    const content = !name && !STOPWORDS.has(tok.text) && tok.text.length >= 3 && !/\d/.test(tok.text);
    out.push({ tok, stem: stem(tok.text), content, name, paragraph: p, sentence: s });
  }
  return out;
}

/** Offsets at which a new paragraph starts (after each blank line). */
function paragraphBreaks(prose: string): number[] {
  const out: number[] = [];
  for (const m of prose.matchAll(/\n\s*\n/g)) out.push(m.index + m[0].length);
  return out;
}

function stopAt(scene: EchoScene, w: readonly Word[], first: number, last: number): EchoStop {
  const a = w[first]!, b = w[last]!;
  const sentence = scene.sentences[a.sentence];
  return {
    scene: scene.ref, index: scene.index, paragraph: a.paragraph,
    from: a.tok.from, to: b.tok.to, text: scene.prose.slice(a.tok.from, b.tok.to),
    sentence: (sentence ? sentence.text : scene.prose.slice(a.tok.from, b.tok.to)).trim().slice(0, 240),
  };
}

// --- surface tier --------------------------------------------------------------

interface Run { readonly key: string; readonly si: number; readonly start: number; readonly end: number }

/**
 * Maximal repeated runs: every `minGram` of stems that recurs is a
 * seed, and the seed is stretched left and right for as long as every
 * occurrence still agrees and stays inside its sentence. So a phrase is
 * reported whole, once — "there was salt on the wind", not "salt on
 * the" and "on the wind" — and a long verbatim repeat made mostly of
 * small words is still heard. A run needs two content words (or seven
 * words), no name, and occurrences in two different paragraphs.
 */
function surface(scenes: readonly EchoScene[], tokens: readonly (readonly Word[])[], o: EchoOptions): { groups: EchoGroup[]; runs: Run[] } {
  const n = Math.max(2, o.minGram);
  const seeds = new Map<string, { si: number; at: number }[]>();
  tokens.forEach((w, si) => {
    for (let i = 0; i + n <= w.length; i++) {
      const run = w.slice(i, i + n);
      if (run.some((x) => x.name) || run[0]!.sentence !== run[n - 1]!.sentence) continue;
      const key = run.map((x) => x.stem).join(" ");
      (seeds.get(key) ?? seeds.set(key, []).get(key)!).push({ si, at: i });
    }
  });
  const groups: EchoGroup[] = [];
  const runs: Run[] = [];
  const seen = new Set<string>();
  const agree = (occ: readonly { si: number; at: number }[], offset: number, edge: (x: { si: number; at: number }) => number): boolean => {
    const ws = occ.map((x) => tokens[x.si]![edge(x) + offset]);
    const anchor = occ.map((x) => tokens[x.si]![x.at]!);
    if (ws.some((w) => !w || w.name)) return false;
    if (ws.some((w, i) => w!.sentence !== anchor[i]!.sentence)) return false;
    return ws.every((w) => w!.stem === ws[0]!.stem);
  };
  for (const occ of seeds.values()) {
    if (occ.length < 2) continue;
    let left = 0, right = 0;
    while (agree(occ, -(left + 1), (x) => x.at)) left++;
    while (agree(occ, right + 1, (x) => x.at + n - 1)) right++;
    const spans = occ.map((x) => ({ si: x.si, start: x.at - left, end: x.at + n - 1 + right }));
    const id = spans.map((x) => `${x.si}:${x.start}-${x.end}`).sort().join(",");
    if (seen.has(id)) continue;
    seen.add(id);
    const first = spans[0]!;
    const run = tokens[first.si]!.slice(first.start, first.end + 1);
    const content = run.filter((x) => x.content).length;
    if (content < 2 && run.length < 7) continue;
    const paragraphs = new Set(spans.map((x) => `${x.si}:${tokens[x.si]![x.start]!.paragraph}`));
    if (paragraphs.size < 2) continue;
    const key = `surface:${run.map((x) => x.stem).join(" ")}`;
    const stops = spans.map((x) => stopAt(scenes[x.si]!, tokens[x.si]!, x.start, x.end)).sort((a, b) => a.index - b.index || a.from - b.from);
    const sceneSet = new Set(stops.map((s) => s.index));
    let nearest = Number.POSITIVE_INFINITY;
    for (let i = 1; i < stops.length; i++) nearest = Math.min(nearest, stops[i]!.index - stops[i - 1]!.index);
    const score = round(stops.length * proximity(nearest, o) * (1 + (sceneSet.size - 1) * 0.25));
    groups.push({ key, tier: "surface", text: stops[0]!.text, stops, scenes: sceneSet.size, nearest, score });
    for (const x of spans) runs.push({ key, ...x });
  }
  return { groups: groups.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)), runs };
}

// --- lexical tier --------------------------------------------------------------

interface Doc { readonly scene: EchoScene; readonly si: number; readonly w: readonly Word[]; readonly first: number; readonly last: number; readonly paragraph: number; readonly content: number; readonly vec: Map<string, number>; norm: number }

/** How much of the shorter sentence a shared phrase already covers; above this the pair is the phrase's, not the sentence's. */
const PHRASE_COVERS = 0.6;

/**
 * Sentences as bags of stemmed content words, weighted by tf-idf, and
 * compared by cosine. Candidates come from an inverted index over the
 * rarer stems — never every pair — so a long novel stays quick. A pair
 * the surface tier has already explained (the shared phrase is most of
 * both sentences) is not reported twice.
 */
function lexical(scenes: readonly EchoScene[], tokens: readonly (readonly Word[])[], runs: readonly Run[], o: EchoOptions): EchoPair[] {
  const docs: Doc[] = [];
  scenes.forEach((scene, si) => {
    const w = tokens[si]!;
    let start = 0;
    for (let i = 1; i <= w.length; i++) {
      if (i < w.length && w[i]!.sentence === w[start]!.sentence) continue;
      const run = w.slice(start, i);
      const content = run.filter((x) => x.content);
      if (content.length >= o.minContentWords) {
        const vec = new Map<string, number>();
        for (const x of content) vec.set(x.stem, (vec.get(x.stem) ?? 0) + 1);
        docs.push({ scene, si, w, first: start, last: i - 1, paragraph: run[0]!.paragraph, content: content.length, vec, norm: 0 });
      }
      start = i;
    }
  });
  if (docs.length < 2) return [];
  const df = new Map<string, number>();
  for (const d of docs) for (const s of d.vec.keys()) df.set(s, (df.get(s) ?? 0) + 1);
  const idf = (s: string) => Math.log(1 + docs.length / (df.get(s) ?? 1));
  for (const d of docs) {
    let sum = 0;
    for (const [s, tf] of d.vec) { const wgt = tf * idf(s); d.vec.set(s, wgt); sum += wgt * wgt; }
    d.norm = Math.sqrt(sum);
  }
  // Candidate pairs share at least two stems that are not everywhere.
  const cap = Math.max(20, Math.floor(docs.length * 0.05));
  const postings = new Map<string, number[]>();
  docs.forEach((d, i) => { for (const s of d.vec.keys()) if ((df.get(s) ?? 0) <= cap) (postings.get(s) ?? postings.set(s, []).get(s)!).push(i); });
  const shared = new Map<string, number>();
  for (const list of postings.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const k = `${list[x]}:${list[y]}`;
    shared.set(k, (shared.get(k) ?? 0) + 1);
  }
  const explained = (a: Doc, b: Doc): boolean => {
    const inside = (d: Doc) => runs.filter((r) => r.si === d.si && r.start >= d.first && r.end <= d.last);
    const ra = inside(a), rb = inside(b);
    for (const x of ra) for (const y of rb) {
      if (x.key !== y.key) continue;
      const covered = tokens[x.si]!.slice(x.start, x.end + 1).filter((t) => t.content).length;
      if (covered >= PHRASE_COVERS * Math.min(a.content, b.content)) return true;
    }
    return false;
  };
  const pairs: EchoPair[] = [];
  for (const [k, n] of shared) {
    if (n < 2) continue;
    const [i, j] = k.split(":").map(Number) as [number, number];
    const a = docs[i]!, b = docs[j]!;
    if (a.si === b.si && a.paragraph === b.paragraph) continue;
    let dot = 0;
    for (const [s, wa] of a.vec) { const wb = b.vec.get(s); if (wb) dot += wa * wb; }
    const cosine = dot / (a.norm * b.norm || 1);
    if (cosine < o.minCosine || explained(a, b)) continue;
    const sa = stopAt(a.scene, a.w, a.first, a.last), sb = stopAt(b.scene, b.w, b.first, b.last);
    const [x, y] = sa.index < sb.index || (sa.index === sb.index && sa.from <= sb.from) ? [sa, sb] : [sb, sa];
    const distance = y.index - x.index;
    pairs.push({ key: `lexical:${x.index}:${x.from}|${y.index}:${y.from}`, tier: "lexical", a: x, b: y, similarity: round(cosine), score: round(cosine * proximity(distance, o)), distance });
  }
  return pairs.sort((p, q) => q.score - p.score || p.key.localeCompare(q.key)).slice(0, o.maxPairs);
}

function round(n: number): number { return Math.round(n * 1000) / 1000; }

// --- entry ----------------------------------------------------------------------

/** Every echo in a project's scenes, best first. Pure and deterministic. */
export function findEchoes(scenes: readonly EchoScene[], options: EchoOptions = DEFAULT_ECHO_OPTIONS): Echoes {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  const tokens = ordered.map((s) => words(s, options.names));
  const { groups, runs } = surface(ordered, tokens, options);
  const pairs = lexical(ordered, tokens, runs, options);
  return { groups, pairs };
}

// --- muting ---------------------------------------------------------------------

function plain(s: string): string {
  return s.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[^\p{L}\p{N}'\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** The writer's quotes claim an echo: a quote that contains the phrase, or a sentence that contains the quote (or the reverse). */
export function isMuted(text: string, quotes: readonly string[]): boolean {
  const t = plain(text);
  if (!t) return false;
  return quotes.some((q) => { const p = plain(q); return p.length > 0 && (p.includes(t) || t.includes(p)); });
}

/** Echoes the writer has kept as motifs — or otherwise quoted in a thread — are theirs and no longer findings. */
export function muteEchoes(echoes: Echoes, quotes: readonly string[]): Echoes {
  if (quotes.length === 0) return echoes;
  return {
    groups: echoes.groups.filter((g) => !isMuted(g.text, quotes)),
    pairs: echoes.pairs.filter((p) => !isMuted(p.a.sentence, quotes) && !isMuted(p.b.sentence, quotes)),
  };
}
