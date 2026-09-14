import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { conventionsFacet, conventionsFor, dialogueExtension, paragraphsIn, rosterFor, rostersFacet } from "../../../src/infrastructure/codemirror/dialogueExtension";
import { allFindings } from "../../../src/infrastructure/codemirror/findingsTooltip";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";
import { mount, type Harness } from "./helpers";

const DOC = "“You came alone?” Tomas did not look up.\n\n_He is guessing._\n\nThe keeper snorted.";
const texts = (h: Harness, cls: string) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(`.${cls}`)).map((m) => m.textContent);
const ROSTER = { "": [{ id: "m", name: "Mara", aliases: [], colour: "#111111" }, { id: "t", name: "Tomas", aliases: [], colour: "#222222" }] };
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

  it("tints speech in the speaker's colour, grey when nobody can be pinned, and says who on hover", () => {
    h = mount(EXCHANGE, ext("ch1.md", {}, ROSTER), { lens: "dialogue" });
    expect(styles(h, "czm-speech")).toEqual(["--czm-speech: #222222", "--czm-speech: #111111", "--czm-speech: #8a8a8a"]);
    expect(styles(h, "czm-thought")).toEqual(["--czm-speech: #222222"]);
    expect(allFindings(h.view).map((f) => f.note)).toEqual(["Tomas · named in the paragraph", "Mara · turn-taking", "Tomas · turn-taking", "speaker not found · no tag or name in this paragraph and no clean turn-taking"]);
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
    const rosters = { ...ROSTER, "book/": [{ id: "i", name: "Ilse", aliases: [], colour: "#333333" }] };
    h = mount("“Go,” Ilse said.", ext("book/ch1.md", {}, rosters), { lens: "dialogue" });
    expect(styles(h, "czm-speech")).toEqual(["--czm-speech: #333333"]);
    expect(rosterFor(rosters, "book/ch1.md")[0]!.name).toBe("Ilse");
    expect(rosterFor(rosters, "elsewhere.md")[0]!.name).toBe("Mara");
    expect(rosterFor({}, "elsewhere.md")).toEqual([]);
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
