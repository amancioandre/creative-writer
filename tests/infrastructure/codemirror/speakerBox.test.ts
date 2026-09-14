import { describe, it, expect, afterEach, vi } from "vitest";
import { conventionsFacet, dialogueExtension, rostersFacet } from "../../../src/infrastructure/codemirror/dialogueExtension";
import { pinChange, tagSpeaker, type BoxParagraph } from "../../../src/infrastructure/codemirror/speakerBox";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";
import { mount, type Harness } from "./helpers";

const ROSTER = { "book/": [{ id: "m", name: "Mara", aliases: [], colour: "#111111", accent: [], accentNever: [] }, { id: "t", name: "Tomas", aliases: [], colour: "#222222", accent: [], accentNever: [] }] };
const ext = () => [conventionsFacet.of({}), rostersFacet.of(ROSTER), dialogueExtension(() => "book/ch1.md")];
const DOC = "Mara stepped in.\n\n“You came alone?” Tomas did not look up.\n\n“Yes.”";
const box = (h: Harness) => h.view.dom.querySelector<HTMLElement>(".czm-speaker-box");
const chips = (h: Harness) => Array.from(box(h)?.querySelectorAll<HTMLElement>(".czm-speaker-chip") ?? []).map((c) => c.textContent);
const key = (h: Harness, k: string) => h.view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

describe("pinChange", () => {
  const span = (from: number, to: number) => ({ from, to, kind: "speech" as const });
  const p = (spans: BoxParagraph["spans"], pins: BoxParagraph["pins"]): BoxParagraph => ({ from: 10, to: 60, spans, pins, attribution: null, voices: spans.map(() => null) });
  it("writes a pin before the sentence, replaces one that is there, and removes one with its space", () => {
    expect(pinChange(p([span(16, 22)], []), 0, "Mara")).toEqual({ from: 26, to: 26, insert: "%% Mara %% " });
    const pinned = p([span(11, 17)], [{ from: 0, to: 11, label: "Mara", notSpeech: false }]);
    expect(pinChange(pinned, 0, "Tomas")).toEqual({ from: 10, to: 21, insert: "%% Tomas %% " });
    expect(pinChange(pinned, 0, null)).toEqual({ from: 10, to: 21, insert: "" });
    // A paragraph pinned "not speech" has no sentence left; the pin itself is the target.
    expect(pinChange(p([], [{ from: 0, to: 17, label: "not speech", notSpeech: true }]), -1, null)).toEqual({ from: 10, to: 27, insert: "" });
  });
});

describe("speaker box", () => {
  let h: Harness;
  afterEach(() => { h?.destroy(); vi.useRealTimers(); });

  it("opens on the command with the cast as chips, the guess selected, and pins on Enter as a hidden comment", () => {
    h = mount(DOC, ext(), { lens: "dialogue" });
    h.moveCursor(DOC.length - 1);
    h.view.dispatch({ effects: tagSpeaker.of(null) });
    expect(box(h)?.textContent).toContain("Speaker not certain · guess: Mara (turn-taking)");
    expect(chips(h)).toEqual(["Mara", "Tomas", "Not speech"]);
    expect(box(h)!.querySelector(".is-selected")?.textContent).toBe("Mara");
    key(h, "ArrowRight");
    expect(box(h)!.querySelector(".is-selected")?.textContent).toBe("Tomas");
    key(h, "Enter");
    expect(h.view.state.doc.toString()).toContain("\n\n%% Tomas %% “Yes.”");
    expect(box(h)).toBeNull();
    const styles = Array.from(h.view.dom.querySelectorAll<HTMLElement>(".czm-speech")).map((m) => m.getAttribute("style"));
    expect(styles).toEqual(["--czm-speech: #222222", "--czm-speech: #222222"]);
  });

  it("puts the pin right before the sentence it names, not at the start of the paragraph", () => {
    h = mount("Mara looked up. “Yes.”", ext(), { lens: "dialogue" });
    h.moveCursor(20);
    h.view.dispatch({ effects: tagSpeaker.of(null) });
    key(h, "Enter");
    expect(h.view.state.doc.toString()).toBe("Mara looked up. %% Mara %% “Yes.”");
  });

  it("a click on a chip pins too, and Unpin takes the comment away", () => {
    h = mount(DOC, ext(), { lens: "dialogue" });
    h.moveCursor(DOC.length - 1);
    h.view.dispatch({ effects: tagSpeaker.of(null) });
    (box(h)!.querySelectorAll<HTMLButtonElement>(".czm-speaker-chip")[2])!.click();
    expect(h.view.state.doc.toString()).toContain("%% not speech %% “Yes.”");
    h.view.dispatch({ effects: tagSpeaker.of(null) });
    expect(box(h)?.textContent).toContain("Not speech · pinned by you");
    expect(chips(h)).toEqual(["Mara", "Tomas", "Not speech", "Unpin"]);
    (box(h)!.querySelectorAll<HTMLButtonElement>(".czm-speaker-chip")[3])!.click();
    expect(h.view.state.doc.toString()).toBe(DOC);
  });

  it("opens by itself when the cursor rests in an uncertain line, passive, and closes when the cursor leaves", async () => {
    vi.useFakeTimers();
    h = mount(DOC, ext(), { lens: "dialogue" });
    h.moveCursor(DOC.length - 1);
    expect(box(h)).toBeNull();
    vi.advanceTimersByTime(700);
    expect(box(h)?.textContent).toContain("Click a name to pin it");
    expect(box(h)!.querySelector(".is-selected")).toBeNull();
    key(h, "Enter");
    expect(h.view.state.doc.toString()).not.toContain("%%");
    h.moveCursor(2);
    await Promise.resolve();
    vi.advanceTimersByTime(700);
    expect(box(h)).toBeNull();
  });

  it("stays shut on its own when told to, and on a certain line", () => {
    vi.useFakeTimers();
    h = mount(DOC, ext(), { lens: "dialogue", dialogue: { ...DEFAULT_SETTINGS.dialogue, autoBox: false } });
    h.moveCursor(DOC.length - 1);
    vi.advanceTimersByTime(700);
    expect(box(h)).toBeNull();
    h.setSettings({ dialogue: DEFAULT_SETTINGS.dialogue });
    h.moveCursor(20);
    vi.advanceTimersByTime(700);
    expect(box(h)).toBeNull();
  });

  it("says so when there is nothing to tag", () => {
    h = mount("Plain narration.", ext(), { lens: "dialogue" });
    h.view.dispatch({ effects: tagSpeaker.of(null) });
    expect(box(h)?.textContent).toBe("No speech in this paragraph");
    h.destroy();
    h = mount(DOC, ext(), { lens: "style" });
    h.view.dispatch({ effects: tagSpeaker.of(null) });
    expect(box(h)?.textContent).toContain("needs to be on");
  });
});
