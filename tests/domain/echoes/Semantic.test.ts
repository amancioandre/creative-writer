import { describe, it, expect } from "vitest";
import { DEFAULT_ECHO_OPTIONS } from "../../../src/domain/echoes/Echoes";
import { normalise, pairEmbeddings, semanticEchoPairs, type EmbeddingCandidate, type SemanticEcho } from "../../../src/domain/echoes/Semantic";

const scene = (title: string) => ({ path: `Novel/${title}.md`, title, line: 0 });
const cand = (title: string, index: number, paragraph: number, text: string): EmbeddingCandidate => ({ scene: scene(title), index, paragraph, text });

/** A vector pointing mostly one way, with a little noise so buckets are not all the same. */
const dir = (axis: number, wobble = 0): number[] => { const v = new Array<number>(16).fill(0.01); v[axis] = 1; if (wobble) v[(axis + 1) % 16] = wobble; return v; };

describe("pairEmbeddings", () => {
  it("pairs sentences whose vectors point the same way, in different paragraphs, best first, with each scene's hash", () => {
    const c = [cand("One", 0, 0, "The lamp guttered and the shadows climbed."), cand("Three", 2, 1, "Shadows rose up the wall as the lamp failed."), cand("One", 0, 0, "Same paragraph, same sense."), cand("Nine", 8, 0, "Something else entirely.")];
    const v = [dir(0), dir(0, 0.2), dir(0, 0.1), dir(5)];
    const pairs = pairEmbeddings(c, v, (s) => `h:${s.title}`, "ollama:nomic");
    expect(pairs.map((p) => [p.a.title, p.b.title, p.quoteA, p.quoteB]).sort()).toEqual([
      ["One", "Three", "Same paragraph, same sense.", "Shadows rose up the wall as the lamp failed."],
      ["One", "Three", "The lamp guttered and the shadows climbed.", "Shadows rose up the wall as the lamp failed."],
    ]);
    expect(pairs[0]).toMatchObject({ hashA: "h:One", hashB: "h:Three", model: "ollama:nomic" });
    expect(pairs[0]!.score).toBeGreaterThanOrEqual(pairs[1]!.score);
    expect(pairs.every((p) => p.score >= 0.88)).toBe(true);
  });

  it("is empty for fewer than two sentences or mismatched inputs, and honours the threshold", () => {
    expect(pairEmbeddings([cand("One", 0, 0, "x")], [dir(0)], () => "h", "m")).toEqual([]);
    expect(pairEmbeddings([cand("One", 0, 0, "x"), cand("Two", 1, 0, "y")], [dir(0)], () => "h", "m")).toEqual([]);
    const c = [cand("One", 0, 0, "x"), cand("Two", 1, 0, "y")];
    expect(pairEmbeddings(c, [dir(0), dir(0, 0.6)], () => "h", "m", 0.99)).toEqual([]);
    expect(pairEmbeddings(c, [dir(0), dir(0, 0.6)], () => "h", "m", 0.8)).toHaveLength(1);
  });

  it("normalises to unit length", () => {
    const u = normalise([3, 4]);
    expect(Math.round(u[0]! * 100) / 100).toBe(0.6);
    expect(Math.round(u[1]! * 100) / 100).toBe(0.8);
    expect([...normalise([0, 0])]).toEqual([0, 0]);
  });
});

describe("semanticEchoPairs", () => {
  const stored: SemanticEcho[] = [
    { a: scene("One"), b: scene("Three"), hashA: "h1", hashB: "h3", quoteA: "The lamp guttered.", quoteB: "The lamp failed.", score: 0.91, model: "m" },
    { a: scene("One"), b: scene("Gone"), hashA: "h1", hashB: "hx", quoteA: "a", quoteB: "b", score: 0.9, model: "m" },
    { a: scene("Three"), b: scene("Five"), hashA: "old", hashB: "h5", quoteA: "c", quoteB: "d", score: 0.9, model: "m" },
  ];
  const index = new Map([["Novel/One.md#One", 0], ["Novel/Three.md#Three", 2], ["Novel/Five.md#Five", 4]]);
  const hashes = new Map([["Novel/One.md#One", "h1"], ["Novel/Three.md#Three", "h3"], ["Novel/Five.md#Five", "h5"]]);

  it("turns stored pairs into echo pairs, ordered by scene, scored by nearness, and counts the stale ones", () => {
    const { pairs, stale } = semanticEchoPairs(stored, index, hashes, DEFAULT_ECHO_OPTIONS);
    expect(stale).toBe(2);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ tier: "semantic", distance: 2, similarity: 0.91, a: { index: 0, sentence: "The lamp guttered." }, b: { index: 2, sentence: "The lamp failed." } });
    expect(pairs[0]!.score).toBeLessThan(0.91);
    expect(pairs[0]!.key.startsWith("semantic:")).toBe(true);
  });
});
