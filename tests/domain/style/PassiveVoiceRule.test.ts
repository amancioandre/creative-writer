import { describe, it, expect } from "vitest";
import { PassiveVoiceRule } from "../../../src/domain/style/rules/PassiveVoiceRule";

const rule = new PassiveVoiceRule();
const spans = (t: string) => rule.analyse(t).map((f) => t.slice(f.from, f.to));

describe("PassiveVoiceRule", () => {
  it.each([
    ["The letter was written by her.", "was written"],
    ["Mistakes were made.", "were made"],
    ["The door is being closed.", "is being closed"],
    ["He has been forgotten.", "has been forgotten"],
    ["It was quickly taken.", "was quickly taken"],
    ["The city got destroyed.", "got destroyed"],
    ["They will be seen.", "will be seen"],
  ])("%s → %s", (text, expected) => {
    expect(spans(text)).toEqual([expected]);
  });

  it("ignores be + adjective / progressive / plain past", () => {
    expect(spans("She was tired and he was running. They walked home.")).toEqual([]);
  });

  it("ignores be + past participle used as a state adjective in the exception list", () => {
    expect(spans("I am interested. We were excited. He is gone.")).toEqual([]);
  });

  it("handles irregular participles", () => {
    expect(spans("The bread was eaten. The song was sung.")).toEqual(["was eaten", "was sung"]);
  });

  it("kind is passive and note explains", () => {
    const [f] = rule.analyse("It was stolen.");
    expect(f!.kind).toBe("passive");
    expect(f!.note).toMatch(/passive/i);
  });
});
