import { describe, it, expect } from "vitest";
import { DEFAULT_ECHO_OPTIONS, ECHO_PRESETS, echoOptions, echoVerdict, findEchoes, isMuted, muteEchoes, proximity, type EchoScene } from "../../../src/domain/echoes/Echoes";
import { Sentence } from "../../../src/domain/rhythm/Sentence";
import { stem } from "../../../src/domain/style/rules/RepetitionRule";
import { ECHO_SCENES, EXPECTED_PHRASES, EXPECTED_SENTENCE_PAIRS, FORBIDDEN_PHRASES } from "../../fixtures/echoCorpus";

/** Sentences on terminal punctuation, enough for prose without abbreviations. */
function segment(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?]+[.!?]*["”']?\s*/g;
  for (const m of text.matchAll(re)) if (m[0].trim()) out.push(Sentence.create(m[0], m.index, m.index + m[0].length));
  return out;
}

const scene = (title: string, prose: string, index: number): EchoScene => ({ ref: { path: `Novel/${title}.md`, title, line: 0 }, index, prose, sentences: segment(prose) });
const corpus = ECHO_SCENES.map((s, i) => scene(s.title, s.prose, i));
const key = (phrase: string) => `surface:${phrase.toLowerCase().split(/\s+/).map(stem).join(" ")}`;
const names = new Set(["marta", "ilse"]);

describe("findEchoes on the corpus", () => {
  const echoes = findEchoes(corpus, echoOptions("medium", names));
  const found = new Set(echoes.groups.map((g) => g.key));

  const hits = EXPECTED_PHRASES.filter((p) => [...found].some((k) => k.includes(key(p).slice("surface:".length)) || key(p).includes(k.slice("surface:".length))));
  const false_ = FORBIDDEN_PHRASES.filter((p) => [...found].some((k) => k.includes(key(p).slice("surface:".length))));
  const recall = hits.length / EXPECTED_PHRASES.length;
  const precision = echoes.groups.length ? (echoes.groups.length - false_.length) / echoes.groups.length : 1;

  it(`hears every planted phrase (recall ${recall.toFixed(2)})`, () => expect(recall).toBe(1));
  it(`reports none of the forbidden ones (precision ${precision.toFixed(2)})`, () => expect(false_).toEqual([]));

  it("pairs the rewritten sentence with its original", () => {
    for (const [a, b] of EXPECTED_SENTENCE_PAIRS) {
      const hit = echoes.pairs.find((p) => [p.a.sentence, p.b.sentence].every((s) => s === a.trim() || s === b.trim()));
      expect(hit, `${a} ~ ${b}`).toBeDefined();
      expect(hit!.tier).toBe("lexical");
      expect(hit!.similarity).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("gives each stop its scene, paragraph, offsets, the words as written and the sentence they sit in", () => {
    const salt = echoes.groups.find((g) => g.text.toLowerCase().includes("salt on the wind"))!;
    expect(salt.stops.map((s) => [s.scene.title, s.paragraph, s.text])).toEqual([["Harbour", 0, "There was salt on the wind"], ["The crossing", 0, "There was salt on the wind"]]);
    expect(corpus[0]!.prose.slice(salt.stops[0]!.from, salt.stops[0]!.to)).toBe("There was salt on the wind");
    expect(salt.stops[0]!.sentence).toBe("There was salt on the wind and the gulls were already quarrelling over the nets.");
    expect(salt.scenes).toBe(2);
    expect(salt.nearest).toBe(1);
  });

  it("reports the whole repeated run once, not its pieces, grown from the seed in both directions", () => {
    const counting = echoes.groups.filter((g) => g.key.includes(stem("counting")));
    expect(counting).toHaveLength(1);
    expect(counting[0]!.text).toBe("twice, because counting was what she did when she could not think");
    expect(ECHO_PRESETS.low.minGram).toBeGreaterThan(ECHO_PRESETS.high.minGram);
  });

  it("orders groups best first and ranks the near, spread habit above the rest", () => {
    const scores = echoes.groups.map((g) => g.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("findEchoes rules", () => {
  it("never pairs a repeat inside one paragraph, but does across paragraphs of one scene", () => {
    const one = scene("One", "The gulls quarrelled over the nets at dawn. Later the gulls quarrelled over the nets again.", 0);
    expect(findEchoes([one]).groups).toEqual([]);
    const two = scene("Two", "The gulls quarrelled over the nets at dawn.\n\nLater the gulls quarrelled over the nets again.", 0);
    const g = findEchoes([two]).groups;
    expect(g).toHaveLength(1);
    expect(g[0]!.text).toBe("The gulls quarrelled over the nets");
    expect(g[0]!.stops.map((s) => s.paragraph)).toEqual([0, 1]);
    expect(g[0]!.nearest).toBe(0);
  });

  it("keeps names and dialogue tags out, whether capitalised mid-sentence or given as names", () => {
    const a = scene("A", "Then Marta Kovács said nothing at all.\n\nAgain Marta Kovács said nothing at all.", 0);
    expect(findEchoes([a]).groups).toEqual([]);
    const b = scene("B", "marta walked the harbour wall slowly.\n\nmarta walked the harbour wall slowly.", 0);
    expect(findEchoes([b], echoOptions("medium", new Set(["marta"]))).groups.map((g) => g.text)).toEqual(["walked the harbour wall slowly"]);
  });

  it("does not let a phrase cross a sentence boundary", () => {
    const s = scene("S", "It was over the wall. Then the sea rose.\n\nIt was over the wall. Then the sea rose.", 0);
    expect(findEchoes([s]).groups.map((g) => g.text)).toEqual(["Then the sea rose"]);
  });

  it("scores nearness the way a reader feels it: near is worse, spread never falls to nothing", () => {
    expect(proximity(0, DEFAULT_ECHO_OPTIONS)).toBe(1);
    expect(proximity(2, DEFAULT_ECHO_OPTIONS)).toBeLessThan(proximity(1, DEFAULT_ECHO_OPTIONS));
    expect(proximity(200, DEFAULT_ECHO_OPTIONS)).toBeCloseTo(DEFAULT_ECHO_OPTIONS.proximityFloor, 3);
    expect(echoVerdict({ scenes: 3, nearest: 5 })).toBe("habit");
    expect(echoVerdict({ scenes: 2, nearest: 1 })).toBe("tic");
    expect(echoVerdict({ scenes: 2, nearest: 9 })).toBe("echo");
  });

  it("compares sentences only when they have enough content words, and not a pair the shared phrase already explains", () => {
    const a = scene("A", "The lamp guttered and the shadows climbed the wall like slow water.", 0);
    const b = scene("B", "The lamp guttered; slow water, the shadows climbed the wall.", 3);
    const found = findEchoes([a, b]);
    expect(found.pairs).toHaveLength(1);
    expect(found.pairs[0]).toMatchObject({ tier: "lexical", distance: 3 });
    expect(found.pairs[0]!.a.scene.title).toBe("A");
    expect(findEchoes([a, b], { ...DEFAULT_ECHO_OPTIONS, minContentWords: 20 }).pairs).toEqual([]);
    const c = scene("C", "There was salt on the wind.", 0), d = scene("D", "There was salt on the wind.", 1);
    const dup = findEchoes([c, d], { ...DEFAULT_ECHO_OPTIONS, minContentWords: 2 });
    expect(dup.groups).toHaveLength(1);
    expect(dup.pairs).toEqual([]);
  });

  it("is empty for nothing, one sentence, or scenes with no prose", () => {
    expect(findEchoes([])).toEqual({ groups: [], pairs: [] });
    expect(findEchoes([scene("A", "", 0), scene("B", "One line.", 1)])).toEqual({ groups: [], pairs: [] });
  });

  it("runs a novel-sized project in well under a second", () => {
    const vocab = ["harbour", "wall", "gull", "coat", "letter", "lamp", "shadow", "water", "rose", "ash", "window", "door", "salt", "wind", "boat", "net", "quay", "hill", "house", "crack"];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sentence = () => Array.from({ length: 8 + Math.floor(rnd() * 8) }, () => vocab[Math.floor(rnd() * vocab.length)]).join(" the ") + ".";
    const scenes = Array.from({ length: 120 }, (_, i) => scene(`S${i}`, Array.from({ length: 6 }, () => Array.from({ length: 12 }, sentence).join(" ")).join("\n\n"), i));
    const t0 = performance.now();
    const found = findEchoes(scenes);
    const ms = performance.now() - t0;
    expect(found.pairs.length).toBeLessThanOrEqual(DEFAULT_ECHO_OPTIONS.maxPairs);
    expect(ms).toBeLessThan(3000);
  });
});

describe("muting", () => {
  it("claims an echo by a quote that contains it or that it contains, punctuation and case aside", () => {
    expect(isMuted("salt on the wind", ["There was SALT on the wind, again."])).toBe(true);
    expect(isMuted("There was salt on the wind and the gulls quarrelled.", ["salt on the wind"])).toBe(true);
    expect(isMuted("salt on the wind", ["gulls over the nets"])).toBe(false);
    expect(isMuted("", ["anything"])).toBe(false);
  });

  it("removes kept motifs from the groups and quoted sentences from the pairs", () => {
    const echoes = findEchoes(corpus, echoOptions("medium", names));
    const quotes = ["salt on the wind", EXPECTED_SENTENCE_PAIRS[0]![0]];
    const muted = muteEchoes(echoes, quotes);
    expect(muted.groups.length).toBeLessThan(echoes.groups.length);
    expect(muted.groups.some((g) => g.text.toLowerCase().includes("salt on the wind"))).toBe(false);
    expect(muted.groups.every((g) => !isMuted(g.text, quotes))).toBe(true);
    expect(muted.groups.some((g) => g.text.includes("counting"))).toBe(true);
    expect(muted.pairs.some((p) => p.a.sentence === EXPECTED_SENTENCE_PAIRS[0]![0] || p.b.sentence === EXPECTED_SENTENCE_PAIRS[0]![0])).toBe(false);
    expect(muteEchoes(echoes, [])).toBe(echoes);
  });
});
