import { describe, it, expect } from "vitest";
import { DEFAULT_CONVENTIONS, dashSpans, findDialogue, parseDialogueMarks, parseThoughtMarks, resolveConventions, singleQuoteSpans, type DialogueConventions } from "../../../src/domain/dialogue/DialogueSpans";

const conv = (patch: Partial<DialogueConventions>): DialogueConventions => ({ ...DEFAULT_CONVENTIONS, ...patch });
const slices = (text: string, c: DialogueConventions) => findDialogue(text, c).map((s) => [s.kind, text.slice(s.from, s.to)]);

describe("findDialogue — speech", () => {
  it("takes double quotes, straight or curly, and runs an unclosed one to the end of the paragraph", () => {
    expect(slices('"You came alone?" Tomas did not look up. “Yes.”', DEFAULT_CONVENTIONS)).toEqual([["speech", '"You came alone?"'], ["speech", "“Yes.”"]]);
    expect(slices('"A speech that goes on', DEFAULT_CONVENTIONS)).toEqual([["speech", '"A speech that goes on']]);
  });
  it("takes single quotes without mistaking apostrophes", () => {
    const text = "'It's the keeper's key,' she said. Tomas' hand didn't move. ‘Aye.’";
    expect(slices(text, conv({ marks: "single" }))).toEqual([["speech", "'It's the keeper's key,'"], ["speech", "‘Aye.’"]]);
    expect(singleQuoteSpans("the keepers' keys")).toEqual([]);
  });
  it("takes dash lines: the paragraph opens with a dash, each further dash toggles narration and speech", () => {
    const text = "— Olá — disse ela. — Vamos embora.";
    expect(slices(text, conv({ marks: "dash" }))).toEqual([["speech", "— Olá "], ["speech", "— Vamos embora."]]);
    expect(dashSpans("Not a dash line — even with one inside.")).toEqual([]);
  });
  it("takes nothing under none", () => {
    expect(slices('"Quoted."', conv({ marks: "none" }))).toEqual([]);
  });
});

describe("findDialogue — thought", () => {
  it("a whole paragraph in italics is a thought; a word or two in italics inside a sentence is emphasis", () => {
    expect(slices("_He is guessing. He has to be guessing._", DEFAULT_CONVENTIONS)).toEqual([["thought", "_He is guessing. He has to be guessing._"]]);
    expect(slices("*He is guessing.*", DEFAULT_CONVENTIONS)).toEqual([["thought", "*He is guessing.*"]]);
    expect(slices("  _Trailing punctuation._!  ", DEFAULT_CONVENTIONS)).toEqual([["thought", "_Trailing punctuation._!"]]);
    expect(slices("_Alone_ was generous. Alone was what he was meant to think.", DEFAULT_CONVENTIONS)).toEqual([]);
    expect(slices("_One thought_ and _another_", DEFAULT_CONVENTIONS)).toEqual([]);
    expect(slices("He was _not going_ to say it.", DEFAULT_CONVENTIONS)).toEqual([]);
    expect(slices("**Bold is not a thought**", DEFAULT_CONVENTIONS)).toEqual([]);
  });
  it("a whole sentence in italics is a thought too: tagged, or standing where a sentence begins", () => {
    expect(slices("_He is guessing,_ she thought. She turned the lantern down.", DEFAULT_CONVENTIONS)).toEqual([["thought", "_He is guessing,_"]]);
    expect(slices("She turned the lantern down — _he has to be guessing_ — and waited.", DEFAULT_CONVENTIONS)).toEqual([["thought", "_he has to be guessing_"]]);
    expect(slices("“Yes.” _Alone was generous. Alone was what he was meant to think._ She turned the lantern down.", DEFAULT_CONVENTIONS)).toEqual([["speech", "“Yes.”"], ["thought", "_Alone was generous. Alone was what he was meant to think._"]]);
    expect(slices("Mara wondered, _is he guessing_, and said nothing.", DEFAULT_CONVENTIONS)).toEqual([]);
    expect(slices("So much _for the three of us_ then.", DEFAULT_CONVENTIONS)).toEqual([]);
  });
  it("any italics, when the writer says so", () => {
    expect(slices("_Alone_ was generous, *he thought*, and snake_case is not.", conv({ thoughts: "italic-any" }))).toEqual([["thought", "_Alone_"], ["thought", "*he thought*"]]);
  });
  it("single quotes as thought, unless single quotes are already speech", () => {
    expect(slices("‘He is guessing,’ she thought.", conv({ thoughts: "single-quotes" }))).toEqual([["thought", "‘He is guessing,’"]]);
    expect(slices("‘Speech here.’", conv({ marks: "single", thoughts: "single-quotes" }))).toEqual([["speech", "‘Speech here.’"]]);
  });
  it("a pattern of the writer's own, group 1 when there is one, and nothing from a broken one", () => {
    expect(slices("~He is guessing~ she thought", conv({ thoughts: "custom", thoughtPattern: "~([^~]+)~" }))).toEqual([["thought", "He is guessing"]]);
    expect(slices("<<Aye>>", conv({ thoughts: "custom", thoughtPattern: "<<[^>]+>>" }))).toEqual([["thought", "<<Aye>>"]]);
    expect(slices("anything", conv({ thoughts: "custom", thoughtPattern: "(" }))).toEqual([]);
    expect(slices("anything", conv({ thoughts: "custom", thoughtPattern: "  " }))).toEqual([]);
  });
  it("speech wins where a thought would overlap it", () => {
    expect(slices('"_Said in italics_"', conv({ thoughts: "italic-any" }))).toEqual([["speech", '"_Said in italics_"']]);
  });
  it("none finds no thought", () => {
    expect(slices("_A thought._", conv({ thoughts: "none" }))).toEqual([]);
  });
});

describe("project conventions", () => {
  it("reads the writer's words for dialogue marks", () => {
    expect(parseDialogueMarks("quotes")).toBe("double");
    expect(parseDialogueMarks("Travessão")).toBe("dash");
    expect(parseDialogueMarks("single-quotes")).toBe("single");
    expect(parseDialogueMarks("off")).toBe("none");
    expect(parseDialogueMarks("guillemets")).toBeUndefined();
    expect(parseDialogueMarks(3)).toBeUndefined();
  });
  it("reads a thought preset or takes anything else as a pattern", () => {
    expect(parseThoughtMarks("italic")).toEqual({ thoughts: "italic-paragraph" });
    expect(parseThoughtMarks("any italics")).toEqual({ thoughts: "italic-any" });
    expect(parseThoughtMarks("none")).toEqual({ thoughts: "none" });
    expect(parseThoughtMarks("~(.+)~")).toEqual({ thoughts: "custom", thoughtPattern: "~(.+)~" });
    expect(parseThoughtMarks("")).toBeUndefined();
  });
  it("lays a project's override over the vault-wide conventions", () => {
    expect(resolveConventions(DEFAULT_CONVENTIONS, { marks: "dash" })).toEqual({ ...DEFAULT_CONVENTIONS, marks: "dash" });
    expect(resolveConventions(DEFAULT_CONVENTIONS, undefined)).toBe(DEFAULT_CONVENTIONS);
  });
});
