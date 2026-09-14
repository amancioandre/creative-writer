import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { conventionsFacet, conventionsFor, dialogueExtension, paragraphsIn, rosterFor, rostersFacet, speakerAtCursor } from "../../../src/infrastructure/codemirror/dialogueExtension";
import { allFindings } from "../../../src/infrastructure/codemirror/findingsTooltip";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";
import { mount, type Harness } from "./helpers";

const DOC = "“You came alone?” Tomas did not look up.\n\n_He is guessing._\n\nThe keeper snorted.";
const texts = (h: Harness, cls: string) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(`.${cls}`)).map((m) => m.textContent);
const ROSTER = { "": [{ id: "m", name: "Mara", aliases: [], colour: "#111111", accent: [], accentNever: ["yes"] }, { id: "t", name: "Tomas", aliases: [], colour: "#222222", accent: ["aye", "ye'll"], accentNever: ["my", "yes"] }] };
const ext = (path: string | null, byScope = {}, rosters = {}) => [conventionsFacet.of(byScope), rostersFacet.of(rosters), dialogueExtension(() => path)];
const styles = (h: Harness, cls: string) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(`.${cls}`)).map((m) => m.getAttribute("style"));

describe("dialogueExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("tints speech and whole-paragraph thoughts and dims the narration under the dialogue lens", () => {
    h = mount(DOC, ext("ch1.md"), { lens: "dialogue" });
    expect(texts(h, "czm-speech")).toEqual(["“You came alone?”"]);
    expect(texts(h, "czm-thought")).toEqual(["_He is guessing._"]);
    expect(texts(h, "czm-narration")).toEqual([" Tomas did not look up.", "The keeper snorted."]);
  });

  it("leaves narration alone when told to", () => {
    h = mount(DOC, ext("ch1.md"), { lens: "dialogue", dialogue: { ...DEFAULT_SETTINGS.dialogue, dimNarration: false } });
    expect(texts(h, "czm-speech")).toHaveLength(1);
    expect(texts(h, "czm-narration")).toHaveLength(0);
  });

  it("marks nothing under another lens and follows a switch", () => {
    h = mount(DOC, ext("ch1.md"), { lens: "words" });
    expect(texts(h, "czm-speech")).toHaveLength(0);
    h.setSettings({ lens: "dialogue" });
    expect(texts(h, "czm-speech")).toHaveLength(1);
  });

  it("follows a project's own conventions inside that project", () => {
    const dash = "— Olá — disse ela.\n\n“Not speech here.”";
    h = mount(dash, ext("livro/cap1.md", { "livro/": { marks: "dash" } }), { lens: "dialogue" });
    expect(texts(h, "czm-speech")).toEqual(["— Olá "]);
    h.destroy();
    h = mount(dash, ext("elsewhere.md", { "livro/": { marks: "dash" } }), { lens: "dialogue" });
    expect(texts(h, "czm-speech")).toEqual(["“Not speech here.”"]);
  });
});

describe("dialogueExtension — speakers", () => {
  let h: Harness;
  afterEach(() => h?.destroy());
  const EXCHANGE = "Mara stepped in.\n\n“You came alone?” Tomas did not look up.\n\n“Yes.”\n\n_He is guessing._\n\n***\n\n“Hello?”";

  it("colours a pinned line in the pinned speaker's colour, and a pin for a name with no note gets a colour of its own", () => {
    const doc = "%% Mara %% “Yes.”\n\n%% The Keeper %% “Go.”\n\n%% not speech %% “A sign on the door.”";
    h = mount(doc, ext("ch1.md", {}, ROSTER), { lens: "dialogue" });
    expect(styles(h, "czm-speech")).toEqual(["--czm-speech: #111111", "--czm-speech: #4a8fe2"]);
    expect(texts(h, "czm-narration")).toContain("%% not speech %% “A sign on the door.”");
  });

  it("tints speech in the speaker's colour, grey when nobody can be pinned, and says who on hover", () => {
    h = mount(EXCHANGE, ext("ch1.md", {}, ROSTER), { lens: "dialogue" });
    // Only what is certain is coloured: the named line; the turns are guesses and stay grey until pinned.
    expect(styles(h, "czm-speech")).toEqual(["--czm-speech: #222222", "--czm-speech: #8a8a8a", "--czm-speech: #8a8a8a"]);
    expect(styles(h, "czm-thought")).toEqual(["--czm-speech: #8a8a8a"]);
    expect(allFindings(h.view)).toEqual([]);
  });

  it("one colour and no hover without a cast, or when speaker colours are off", () => {
    h = mount(EXCHANGE, ext("ch1.md"), { lens: "dialogue" });
    expect(styles(h, "czm-speech")).toEqual([null, null, null]);
    expect(allFindings(h.view)).toEqual([]);
    h.destroy();
    h = mount(EXCHANGE, ext("ch1.md", {}, ROSTER), { lens: "dialogue", dialogue: { ...DEFAULT_SETTINGS.dialogue, speakerColours: false } });
    expect(styles(h, "czm-speech")).toEqual([null, null, null]);
  });

  it("uses the project's cast inside the project and follows a cast change", () => {
    const rosters = { ...ROSTER, "book/": [{ id: "i", name: "Ilse", aliases: [], colour: "#333333", accent: [], accentNever: [] }] };
    h = mount("“Go,” Ilse said.", ext("book/ch1.md", {}, rosters), { lens: "dialogue" });
    expect(styles(h, "czm-speech")).toEqual(["--czm-speech: #333333"]);
    expect(rosterFor(rosters, "book/ch1.md")[0]!.name).toBe("Ilse");
    expect(rosterFor(rosters, "elsewhere.md")[0]!.name).toBe("Mara");
    expect(rosterFor({}, "elsewhere.md")).toEqual([]);
  });
});

describe("dialogueExtension — accents", () => {
  let h: Harness;
  afterEach(() => h?.destroy());
  const SCENE = "Mara came in.\n\n“Aye, my brother sent you. Yes,” Tomas said. My word.\n\n“Yes, my turn,” said Mara.\n\n_Yes, aye._\n\n***\n\n“Yes, aye.”";

  it("marks a speaker's own accent words inside their speech only: green for uses, red for never", () => {
    h = mount(SCENE, ext("ch1.md", {}, ROSTER), { lens: "accents" });
    expect(texts(h, "czm-accent-uses")).toEqual(["Aye"]);
    expect(texts(h, "czm-accent-never")).toEqual(["my", "Yes", "Yes"]);
    expect(texts(h, "czm-speech")).toHaveLength(3);
    expect(styles(h, "czm-speech")[0]).toBe("--czm-speech: #222222");
  });

  it("says whose accent on hover, before who is speaking", () => {
    h = mount(SCENE, ext("ch1.md", {}, ROSTER), { lens: "accents" });
    const notes = allFindings(h.view).map((f) => [f.kind, f.note]);
    expect(notes.slice(0, 4)).toEqual([
      ["accent", "Tomas · accent"],
      ["accent-never", "Tomas never says this · accent-never in the character note"],
      ["accent-never", "Tomas never says this · accent-never in the character note"],
      ["accent-never", "Mara never says this · accent-never in the character note"],
    ]);
    expect(notes).toHaveLength(4);
  });

  it("marks nothing under the dialogue lens", () => {
    h = mount(SCENE, ext("ch1.md", {}, ROSTER), { lens: "dialogue" });
    expect(texts(h, "czm-accent-never")).toEqual([]);
  });
});

describe("conventionsFor", () => {
  it("lays the most specific project's declaration over the settings", () => {
    const byScope = { "book/": { marks: "dash" as const }, "book/part/": { thoughts: "italic-any" as const } };
    expect(conventionsFor(DEFAULT_SETTINGS, byScope, "book/part/ch.md")).toEqual({ ...DEFAULT_SETTINGS.dialogue, thoughts: "italic-any" });
    expect(conventionsFor(DEFAULT_SETTINGS, byScope, "book/ch.md").marks).toBe("dash");
    expect(conventionsFor(DEFAULT_SETTINGS, byScope, null).marks).toBe("double");
  });
});

describe("paragraphsIn", () => {
  it("returns whole paragraphs touching a range, blank lines skipped", () => {
    const doc = EditorState.create({ doc: "a\nb\n\nc\n\n\nd" }).doc;
    expect(paragraphsIn(doc, 2, 5).map((p) => doc.sliceString(p.from, p.to))).toEqual(["a\nb", "c"]);
    expect(paragraphsIn(doc, 0, doc.length).map((p) => doc.sliceString(p.from, p.to))).toEqual(["a\nb", "c", "d"]);
  });
});

describe("dialogueExtension — the lens's hands", () => {
  let h: Harness;
  afterEach(() => h?.destroy());
  const SCENE = "“Aye, my brother,” Tomas said.\n\n“Yes.”";

  it("offers to take a marked word out of the character note, and names the certain speaker at the cursor", () => {
    const edits: [string, string, string, boolean][] = [];
    h = mount(SCENE, [conventionsFacet.of({}), rostersFacet.of(ROSTER), dialogueExtension(() => "ch1.md", { editAccent: (s, list, term, add) => { edits.push([s.name, list, term, add]); } })], { lens: "accents" });
    const fs = allFindings(h.view);
    expect(fs.map((f) => f.actions?.[0]?.label)).toEqual(['Remove "aye" from Tomas\'s accent', 'Remove "my" from Tomas\'s never-say list']);
    fs[1]!.actions![0]!.run();
    expect(edits).toEqual([["Tomas", "accent-never", "my", false]]);
    const who = (pos: number) => { h.moveCursor(pos); return h.view.state.facet(speakerAtCursor).map((f) => f(h.view)).find((s) => s)?.name ?? null; };
    expect(who(2)).toBe("Tomas");
    expect(who(SCENE.length - 1)).toBeNull();
  });
});
