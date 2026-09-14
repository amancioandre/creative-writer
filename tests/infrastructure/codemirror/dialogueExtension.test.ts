import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { conventionsFacet, conventionsFor, dialogueExtension, paragraphsIn } from "../../../src/infrastructure/codemirror/dialogueExtension";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";
import { mount, type Harness } from "./helpers";

const DOC = "“You came alone?” Tomas did not look up.\n\n_He is guessing._\n\nThe keeper snorted.";
const texts = (h: Harness, cls: string) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(`.${cls}`)).map((m) => m.textContent);
const ext = (path: string | null, byScope = {}) => [conventionsFacet.of(byScope), dialogueExtension(() => path)];

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
