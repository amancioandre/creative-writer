import { describe, it, expect } from "vitest";
import { SPEAKER_PALETTE, applyPins, attributeParagraphs, attributeSpeakers, buildRoster, isCertain, knownTo, pinComment, pinEdit, pinOf, pinsIn, type Speaker, type SpokenParagraph } from "../../../src/domain/dialogue/Speakers";
import { DEFAULT_CONVENTIONS, findDialogue } from "../../../src/domain/dialogue/DialogueSpans";

const notes = [
  { path: "Characters/Mara.md", frontmatter: { aliases: ["M."] } },
  { path: "Characters/Tomas.md", frontmatter: { colour: "#C8773A", aliases: "the Roarthian", accent: ["Aye", "ye’ll", "aye"], "accent-never": "my, yes, no" } },
  { path: "Novel/Cast/Ilse.md", frontmatter: { type: "character" } },
  { path: "Other/Cast/Nobody.md", frontmatter: { type: "character" } },
  { path: "Places/Roarth.md", frontmatter: {} },
  { path: "Novel/Chapter 1.md", frontmatter: {} },
];

describe("buildRoster", () => {
  it("takes the character notes inside the project only, colour from the note or the palette in order", () => {
    const r = buildRoster(notes, "Novel/");
    expect(r.map((s) => s.name)).toEqual(["Ilse"]);
    expect(r[0]!.colour).toBe(SPEAKER_PALETTE[0]);
    const all = buildRoster(notes, "");
    expect(all.map((s) => s.name)).toEqual(["Mara", "Tomas", "Ilse", "Nobody"]);
    expect(all[0]!.colour).toBe(SPEAKER_PALETTE[0]);
    expect(all[1]!.colour).toBe("#c8773a");
    expect(all[2]!.colour).toBe(SPEAKER_PALETTE[2]);
    expect(all[1]!.aliases).toEqual(["the Roarthian"]);
    expect(all[1]!.accent).toEqual(["aye", "ye'll"]);
    expect(all[1]!.accentNever).toEqual(["my", "yes", "no"]);
    expect(all[0]!.accent).toEqual([]);
  });
  it("never hands out a palette colour a note has pinned", () => {
    const pinned = [
      { path: "Characters/A.md", frontmatter: { colour: SPEAKER_PALETTE[0] } },
      { path: "Characters/B.md", frontmatter: {} },
      { path: "Characters/C.md", frontmatter: { colour: SPEAKER_PALETTE[2] } },
      { path: "Characters/D.md", frontmatter: {} },
    ];
    const r = buildRoster(pinned, "Characters/");
    expect(r.map((s) => s.colour)).toEqual([SPEAKER_PALETTE[0], SPEAKER_PALETTE[1], SPEAKER_PALETTE[2], SPEAKER_PALETTE[3]]);
    expect(new Set(r.map((s) => s.colour)).size).toBe(4);
  });
  it("a speakers list narrows and orders the cast, adds unknown names and pins colours", () => {
    const r = buildRoster(notes, "", ["the Roarthian", "Mara #123456", "The Keeper #abcdef", "Mara"]);
    expect(r.map((s) => [s.name, s.colour])).toEqual([["Tomas", "#c8773a"], ["Mara", "#123456"], ["The Keeper", "#abcdef"]]);
  });
});

const roster: Speaker[] = [
  { id: "m", name: "Mara", aliases: [], colour: "#111111", accent: [], accentNever: [] },
  { id: "t", name: "Tomas", aliases: ["the Roarthian"], colour: "#222222", accent: [], accentNever: [] },
  { id: "k", name: "The Keeper", aliases: [], colour: "#333333", accent: [], accentNever: [] },
];
const para = (text: string): SpokenParagraph => ({ text, spans: findDialogue(text, DEFAULT_CONVENTIONS) });
const who = (texts: string[]) => attributeSpeakers(texts.map(para), roster).map((a) => (a ? `${a.speaker.name}/${a.how}` : null));

describe("attributeSpeakers", () => {
  it("walks the sample: tag, name, turn-taking, a thought for the listener, grey when nobody can be pinned", () => {
    expect(who([
      "The keeper turned the key. Mara felt the cold reach her.",
      "“You came alone?” Tomas did not look up from the bars.",
      "“Yes.” She turned the lantern down.",
      "“Aye, alone, and with the keeper’s keys in yer belt. My brother sent you.”",
      "_He is guessing. He has to be guessing._",
      "“Nobody sent me. I saw the light and I followed it.”",
      "The Keeper snorted before bending to open the second gate.",
      "“Yes, well,” Tomas said. “Ye’ll be wanting the ledger, then.”",
    ])).toEqual([null, "Tomas/named", "Mara/turns", "Tomas/turns", "Mara/turns", "Mara/turns", null, "Tomas/tag"]);
  });
  it("a dialogue tag wins over other names in the paragraph; an alias counts as the name", () => {
    expect(who(["“No,” said the Roarthian, and Mara looked away."])).toEqual(["Tomas/tag"]);
    expect(who(["Mara watched Tomas. “No.”"])).toEqual([null]);
  });
  it("needs two voices, or one voice and one other present character, before it guesses a turn", () => {
    expect(who(["“Hello?”", "“Anyone?”"])).toEqual([null, null]);
    expect(who(["Tomas said, “Hello?”", "“Anyone?”"])).toEqual(["Tomas/tag", null]);
    expect(who(["Mara stood. Tomas said, “Hello?”", "“Here.”"])).toEqual(["Tomas/tag", "Mara/turns"]);
  });
  it("stops trusting the turn after too much narration, and starts over at a heading or scene break", () => {
    expect(who(["Tomas said, “A.”", "“B,” said Mara.", "Rain.", "More rain.", "Still more.", "“C.”"])).toEqual(["Tomas/tag", "Mara/tag", null, null, null, null]);
    expect(who(["Tomas said, “A.”", "“B,” said Mara.", "***", "“C.”"])).toEqual(["Tomas/tag", "Mara/tag", null, null]);
    expect(who(["Tomas said, “A.”", "“B,” said Mara.", "## Two", "“C.”"])).toEqual(["Tomas/tag", "Mara/tag", null, null]);
  });
  it("a name inside speech does not attribute", () => {
    expect(who(["“Mara, come here.”"])).toEqual([null]);
  });
});

describe("pins", () => {
  it("reads the writer's pin at the start of a paragraph, and not speech", () => {
    expect(pinOf("%% Tomas %% “Aye.”")).toEqual({ from: 0, to: 12, label: "Tomas", notSpeech: false });
    expect(pinOf("  %%not speech%% “A sign.”")).toEqual({ from: 2, to: 17, label: "not speech", notSpeech: true });
    expect(pinOf("“Aye.” %% Tomas %%")).toBeNull();
    expect(pinComment("Mara")).toBe("%% Mara %%");
  });
  it("a pin is certain, a turn is not", () => {
    expect(isCertain("pinned")).toBe(true);
    expect(isCertain("tag")).toBe(true);
    expect(isCertain("named")).toBe(true);
    expect(isCertain("turns")).toBe(false);
  });
  it("finds a pin at the start or right before a sentence, and leaves other comments alone", () => {
    const text = "%% TODO: cut %% Mara looked up. %% Tomas %% “Aye.” %% remember the lamp %% “No.” %% the Roarthian %% “Aye.”";
    const spans = findDialogue(text, DEFAULT_CONVENTIONS);
    // Two words or fewer read as a name even with no note; longer needs the cast to know it; a colon is never a pin.
    expect(pinsIn(text, spans).map((p) => p.label)).toEqual(["Tomas", "the Roarthian"]);
    const longer = "%% Tomas of the Gate %% “Aye.” %% remember the lamp %% “No.”";
    const roarth = { ...roster[1]!, aliases: ["Tomas of the Gate"] };
    expect(pinsIn(longer, findDialogue(longer, DEFAULT_CONVENTIONS)).map((p) => p.label)).toEqual([]);
    expect(pinsIn(longer, findDialogue(longer, DEFAULT_CONVENTIONS), knownTo([roarth])).map((p) => p.label)).toEqual(["Tomas of the Gate"]);
    expect(pinsIn("%% Mara %% _A thought._", [])[0]!.label).toBe("Mara");
    const applied = applyPins("%% not speech %% “A sign.” “Real.”", findDialogue("                 “A sign.” “Real.”", DEFAULT_CONVENTIONS));
    expect(applied.spans.map((s) => s.from)).toEqual([27]);
    expect(applyPins("%% not speech %% _A thought._", findDialogue("                 _A thought._", DEFAULT_CONVENTIONS)).spans).toEqual([]);
  });
  it("edits the pin before a sentence: written, replaced, removed", () => {
    const text = "Mara looked up. %% Tomas %% “Aye.” “No.”";
    const spans = findDialogue(text, DEFAULT_CONVENTIONS);
    const pins = pinsIn(text, spans);
    expect(pinEdit(pins, spans[0]!, "Mara")).toEqual({ from: 16, to: 28, insert: "%% Mara %% " });
    expect(pinEdit(pins, spans[0]!, null)).toEqual({ from: 16, to: 28, insert: "" });
    expect(pinEdit(pins, spans[1]!, "Mara")).toEqual({ from: spans[1]!.from, to: spans[1]!.from, insert: "%% Mara %% " });
  });
  it("a sentence pinned on its own keeps its speaker, and the last voice takes the turn", () => {
    const text = "“Go,” Tomas said. %% Mara %% “No.”";
    const p = { text, ...applyPins(text, findDialogue(text, DEFAULT_CONVENTIONS)) };
    const [out] = attributeParagraphs([p, para("“Fine.”")], roster);
    expect(out!.spans.map((a) => `${a!.speaker.name}/${a!.how}`)).toEqual(["Tomas/tag", "Mara/pinned"]);
    expect(attributeParagraphs([p, para("“Fine.”")], roster)[1]!.attribution?.speaker.name).toBe("Tomas");
  });
  it("a pin wins over everything, feeds the turns after it, and an unknown name becomes a speaker with its own colour", () => {
    const texts = ["%% Mara %% “Yes,” Tomas said.", "“No.”", "%% The Keeper %% “Out.”", "%% The Keeper %% “Now.”"];
    const out = attributeSpeakers(texts.map((t) => ({ ...para(t), pin: pinOf(t) })), roster);
    expect(out.map((a) => (a ? `${a.speaker.name}/${a.how}` : null))).toEqual(["Mara/pinned", "Tomas/turns", "The Keeper/pinned", "The Keeper/pinned"]);
    const stranger = attributeSpeakers([{ ...para("%% Ilse %% “Hm.”"), pin: pinOf("%% Ilse %% “Hm.”") }], roster);
    expect(stranger[0]!.speaker.name).toBe("Ilse");
    expect(roster.map((s) => s.colour)).not.toContain(stranger[0]!.speaker.colour);
  });
});
