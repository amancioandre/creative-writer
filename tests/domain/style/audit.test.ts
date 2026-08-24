import { describe, it, expect } from "vitest";
import { AnalyzeParagraphStyle } from "../../../src/application/use-cases/AnalyzeParagraphStyle";
import { CompromiseTagger } from "../../../src/infrastructure/nlp/CompromiseTagger";
import { BrysbaertConcreteness } from "../../../src/infrastructure/nlp/BrysbaertConcreteness";
import { FINDING_KINDS, type FindingKind } from "../../../src/domain/style/Finding";

/**
 * Regression pins from the 2026-08-24 rule audit. Each line is a sentence a
 * rule got wrong before: the left column is what the whole pipeline must
 * flag (kind:span), the empty ones must stay clean. Tagger path only —
 * that is what the plugin runs.
 */
const uc = AnalyzeParagraphStyle.withDefaultRules(new CompromiseTagger(), new BrysbaertConcreteness());
const run = (text: string, kinds: readonly FindingKind[] = FINDING_KINDS) =>
  uc.execute({ text, paragraphFrom: 0, enabled: new Set(kinds) }).map((f) => `${f.kind}:${text.slice(f.from, f.to)}`);

const MUST_FLAG: Array<[string, string]> = [
  ["He got hit by a truck.", "passive:got hit"],
  ["She wasn't told.", "passive:wasn't told"],
  ["It was not sent.", "passive:was not sent"],
  ["Was the letter sent?", "passive:Was the letter sent"],
  ["It could have been stolen.", "passive:could have been stolen"],
  ["The door was closed for the night by the guard.", "passive:was closed"],
  ["They carried out an investigation.", "nominalization:carried out an investigation"],
  ["He made a very bad decision.", "nominalization:made a very bad decision"],
  ["She gave him an explanation.", "nominalization:gave him an explanation"],
  ["They made improvements.", "nominalization:made improvements"],
  ["Alice took the stories. The story was old.", "repetition:story"],
  ["The building shook. Buildings shake.", "repetition:Buildings"],
  ["She could see the road.", "filter:could see"],
  ["She found herself running.", "filter:found herself"],
  ["He knew that she was lying.", "filter:knew"],
  ["He realised the room was empty.", "filter:realised"],
  ["The silence did not bruise him.", "metaphor:silence did not bruise"],
  ["Silence bruised him.", "metaphor:Silence bruised"],
  ["A cold truth.", "metaphor:cold truth"],
  ["A velvet silence settled over the room.", "metaphor:velvet silence"],
  ["A flood of memories.", "metaphor:A flood of memories"],
  ["She hit the glass ceiling.", "metaphor:the glass ceiling"],
  ["Her heart was pounding in her chest.", "cliche:heart was pounding in her chest"],
  ["It was a catch-22.", "cliche:catch-22"],
  ['"Go," she told him gently.', "adverb:gently"],
];

const MUST_BE_CLEAN = [
  "They were eleven.", "It was Sweden.", "The door was closed by then.", "It was crooked.", "He was fed up.",
  "She reached the station.", "He had a pension.", "I have an analysis.",
  "Anna smiled. Later Anna frowned.", "The door opened. The wind howled. The rain fell.", "It was 3.5 km. It was far.",
  "Mr. Ford spoke. Mr. Ford paused.",
  "See you tomorrow.", "The felt was rough.", "She smelled of roses.", "He knew the town well.",
  "The watched pot never boils.", "Feel free to ask.", '"I decided," he said.', "He heard from her yesterday.",
  "The soup tasted good.", "He realised his dream.",
  "Office hours are nine to five.", "The car's history was long.", "The problem was a car.", "He hammered something.",
  "They cut the budget.", "A flood of water.", "A beam of light crossed the floor.", "The roots of the tree.", "Steeped in tea.",
  "A crescent moon rose over the barn.", "The kitten nestled in her lap.", "She loved cats and dogs.",
  "Obviously she was wrong. Certainly he agreed. Clearly it failed.", "Suddenly, the door opened.",
  "Emily and Billy picked the lily.", "The wobbly, bubbly, cuddly puppy.", '"Walk slowly," she said.',
  "The pearly gates and the steely gaze.",
];

describe("rule audit regressions", () => {
  for (const [text, expected] of MUST_FLAG) {
    it(`flags ${expected} in ${JSON.stringify(text)}`, () => {
      expect(run(text)).toContain(expected);
    });
  }
  for (const text of MUST_BE_CLEAN) {
    it(`leaves ${JSON.stringify(text)} alone`, () => {
      expect(run(text)).toEqual([]);
    });
  }
  it("does not read a noun as a filter verb, nor a determiner as an abstract noun", () => {
    expect(run("A thought struck her.", ["filter"])).toEqual([]);
    expect(run("and the office… The office grew stranger for the past few years.", ["metaphor"])).toEqual([]);
  });
  it("sentence-adverb note has no dangling space and no dialogue claim without a quote", () => {
    const [f] = uc.execute({ text: "Slowly, she rose.", paragraphFrom: 0, enabled: new Set(["adverb"]) });
    expect(f!.note).toBe('Adverb. Is there a verb that already carries "slowly"?');
    const [g] = uc.execute({ text: "He gasped quietly.", paragraphFrom: 0, enabled: new Set(["adverb"]) });
    expect(g!.note).not.toMatch(/dialogue/);
  });
  it("repetition note is grammatical at one word back", () => {
    const [f] = uc.execute({ text: "Okay okay then.", paragraphFrom: 0, enabled: new Set(["repetition"]) });
    expect(f?.note ?? "").not.toMatch(/1 words/);
  });
});
