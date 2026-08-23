import { describe, it, expect } from "vitest";
import { PassiveVoiceRule } from "../../../src/domain/style/rules/PassiveVoiceRule";
import { AdverbRule } from "../../../src/domain/style/rules/AdverbRule";
import { NominalizationRule } from "../../../src/domain/style/rules/NominalizationRule";
import { WeakVerbRule } from "../../../src/domain/style/rules/WeakVerbRule";
import { CompromiseTagger } from "../../../src/infrastructure/nlp/CompromiseTagger";
import { PASSIVE_CORPUS } from "../../fixtures/passiveCorpus";
import type { StyleRule } from "../../../src/domain/style/StyleRule";

const tagger = new CompromiseTagger();
const spans = (rule: StyleRule, t: string) => rule.analyse(t).map((f) => t.slice(f.from, f.to));

function score(rule: StyleRule) {
  let tp = 0, fp = 0, fn = 0;
  for (const [sentence, expected] of PASSIVE_CORPUS) {
    const got = spans(rule, sentence);
    for (const g of got) (expected.includes(g) ? tp++ : fp++);
    for (const e of expected) if (!got.includes(e)) fn++;
  }
  return { precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1), tp, fp, fn };
}

describe("PassiveVoiceRule with tagger vs without", () => {
  const regex = score(new PassiveVoiceRule());
  const tagged = score(new PassiveVoiceRule(tagger));

  it("regex baseline is decent", () => {
    expect(regex.recall).toBeGreaterThanOrEqual(0.9);
  });
  it("tagger-backed recall is at least the baseline's", () => {
    expect(tagged.recall).toBeGreaterThanOrEqual(regex.recall);
  });
  it("tagger-backed precision is at least the baseline's and ≥ 0.9", () => {
    expect(tagged.precision).toBeGreaterThanOrEqual(regex.precision);
    expect(tagged.precision).toBeGreaterThanOrEqual(0.9);
  });
  it("tagger catches a stative-looking word used as a true passive (\"was closed on Sundays\" stays unflagged, \"was closed by the council\" is flagged)", () => {
    expect(spans(new PassiveVoiceRule(tagger), "The road was closed by the council.")).toEqual(["was closed"]);
    expect(spans(new PassiveVoiceRule(tagger), "The shop was closed on Sundays.")).toEqual([]);
  });
});

describe("AdverbRule with tagger", () => {
  const rule = new AdverbRule(tagger);
  it("uses the tag rather than the suffix, so non-adverb -ly words are skipped without a list", () => {
    expect(spans(rule, "The lonely assembly met in Italy early.")).toEqual([]);
  });
  it("still flags manner adverbs", () => {
    expect(spans(rule, "He spoke softly and moved carefully.")).toEqual(["softly", "carefully"]);
  });
  it("still spares structural adverbs (only, really, probably)", () => {
    expect(spans(rule, "It was probably only a dream, really.")).toEqual([]);
  });
});

describe("NominalizationRule", () => {
  const rule = new NominalizationRule(tagger);
  it("flags weak verb + nominalised noun and suggests the verb", () => {
    const fs = rule.analyse("She made a decision to leave.");
    expect(fs).toHaveLength(1);
    expect(fs[0]!.kind).toBe("nominalization");
    expect(fs[0]!.note).toMatch(/decide/);
  });
  it.each([
    ["They reached an agreement.", "reached an agreement"],
    ["He gave an explanation.", "gave an explanation"],
    ["We conducted an investigation.", "conducted an investigation"],
    ["I took a quick look at the proposal.", "took a quick look"],
    ["They came to the conclusion.", "came to the conclusion"],
  ])("%s → %s", (text, expected) => {
    expect(spans(rule, text)).toEqual([expected]);
  });
  it("leaves real nouns alone", () => {
    expect(spans(rule, "She made a cake. He gave a speech to the nation.")).toEqual([]);
  });
});

describe("WeakVerbRule", () => {
  const rule = new WeakVerbRule(tagger);
  it("flags a long sentence carried only by a copula", () => {
    const t = "The room at the end of the long corridor on the second floor was very cold and dark.";
    expect(spans(rule, t)).toEqual(["was"]);
  });
  it("ignores short copula sentences and sentences with a real verb", () => {
    expect(spans(rule, "The sky was red.")).toEqual([]);
    expect(spans(rule, "The room at the end of the corridor on the second floor was cold, and she shivered.")).toEqual([]);
  });
  it("kind is weakverb with a note", () => {
    const [f] = rule.analyse("The house on the hill above the quiet village by the river was old and grey and tired.");
    expect(f!.kind).toBe("weakverb");
    expect(f!.note).toMatch(/verb/i);
  });
});
