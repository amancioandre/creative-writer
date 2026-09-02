import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { MANUSCRIPT_VIEW_TYPE, ManuscriptView, type ManuscriptSource } from "../../../src/infrastructure/obsidian/views/ManuscriptView";
import { buildManuscript, type ManuscriptNote } from "../../../src/domain/manuscript/Manuscript";
import { DEFAULT_MANUSCRIPT, type ManuscriptSettings } from "../../../src/domain/settings/Settings";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";
import type { ProjectSpec } from "../../../src/domain/progress/Project";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const seg = new IntlSentenceSegmenter();

function open(notes: ManuscriptNote[], overrides: Partial<ManuscriptSource> = {}) {
  const calls = { revealed: [] as [string, number, number, boolean][], links: [] as string[], renders: 0, exported: [] as string[], comments: [] as [string, number, string][] };
  let settings: ManuscriptSettings = DEFAULT_MANUSCRIPT;
  const src: ManuscriptSource = {
    projects: () => [novel],
    activeProject: () => novel,
    build: async () => buildManuscript(novel, notes, settings),
    render: async (md, el) => { calls.renders++; el.createEl("p").innerHTML = md.replace(/^#+\s*/, "").replace(/\*/g, ""); },
    segment: (t) => seg.segment(t),
    reveal: (p, l, c, f) => { calls.revealed.push([p, l, c, f]); },
    openLink: (l) => { calls.links.push(l); },
    settings: () => settings,
    updateSettings: (next) => { settings = next; },
    exportNote: async (p) => { calls.exported.push(p.name); return "Novel/Novel (manuscript).md"; },
    appendComment: async (p, l, c) => { calls.comments.push([p, l, c]); },
    ...overrides,
  };
  const v = new ManuscriptView(new WorkspaceLeaf(), src);
  document.body.appendChild(v.contentEl);
  return { v, calls, notes };
}

const key = (el: Element, key: string, init: KeyboardEventInit = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
const click = (el: Element) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));

const chapterOne = "# Chapter One\nMarta woke *before* Ilse.\n\n## Creek\nIlse found the creek. She stayed.";
const notes = (): ManuscriptNote[] => [
  { path: "Novel/Part One/01 Chapter One.md", frontmatter: {}, text: chapterOne },
  { path: "Novel/Part One/02 Chapter Two.md", frontmatter: {}, text: "Two." },
  { path: "Novel/Characters/Ilse.md", frontmatter: {}, text: "Younger." },
];

describe("ManuscriptView", () => {
  it("has a stable type and title", async () => {
    const { v } = open(notes());
    await v.onOpen();
    expect(v.getViewType()).toBe(MANUSCRIPT_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Manuscript · Novel");
  });

  it("renders the outline as eyebrows, the notes' blocks, and counts without comment text", async () => {
    const { v } = open([...notes(), { path: "Novel/Part One/03.md", frontmatter: {}, text: "Three. %% four five six %%" }]);
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-ms-count")?.textContent).toBe("3 sections · 15 words · 1 comment");
    expect([...el.querySelectorAll(".czm-ms-page > *")].map((n) => `${n.tagName}.${n.className.split(" ")[0]}`)).toEqual(["H1.czm-ms-folder", "DIV.czm-ms-note", "DIV.czm-ms-note", "DIV.czm-ms-note"]);
    expect(el.querySelector(".czm-ms-folder")?.textContent).toBe("Part One");
    const one = el.querySelector(".czm-ms-note")!;
    expect(one.querySelector(".czm-ms-title")).toBeNull();
    expect([...one.querySelectorAll(".czm-ms-block")].map((b) => b.getAttribute("data-line"))).toEqual(["0", "1", "3", "4"]);
    expect(one.querySelector(".czm-ms-heading p")?.textContent).toBe("Chapter One");
    expect(el.querySelectorAll(".czm-ms-note")[1]!.querySelector(".czm-ms-title")?.textContent).toBe("Chapter Two1 words");
    expect([...el.querySelectorAll(".czm-ms-tool")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true", null]);
  });

  it("selects on click without taking the editor's focus, and edits on double click at the sentence", async () => {
    const { v, calls } = open(notes());
    await v.onOpen();
    const blocks = v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block");
    click(blocks[3]!);
    expect(blocks[3]!.classList.contains("is-active")).toBe(true);
    expect(blocks[3]!.tabIndex).toBe(0);
    expect(blocks[0]!.tabIndex).toBe(-1);
    expect(calls.revealed).toEqual([["Novel/Part One/01 Chapter One.md", 4, 0, false]]);
    const text = blocks[3]!.querySelector("p")!.firstChild as Text;
    const original = document.caretRangeFromPoint;
    document.caretRangeFromPoint = () => { const r = document.createRange(); r.setStart(text, text.data.indexOf("stayed")); return r; };
    blocks[3]!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    document.caretRangeFromPoint = original;
    expect(calls.revealed.at(-1)).toEqual(["Novel/Part One/01 Chapter One.md", 4, "Ilse found the creek. ".length, true]);
    click(v.contentEl.querySelector<HTMLElement>(".czm-ms-title")!);
    expect(calls.revealed.at(-1)).toEqual(["Novel/Part One/02 Chapter Two.md", 0, 0, true]);
  });

  it("moves with the keyboard: arrows, chapters, home and end, Enter to edit", async () => {
    const { v, calls } = open(notes());
    await v.onOpen();
    const blocks = v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block");
    expect(blocks[0]!.tabIndex).toBe(0);
    key(blocks[0]!, "ArrowDown");
    expect(blocks[1]!.classList.contains("is-active")).toBe(true);
    expect(document.activeElement).toBe(blocks[1]);
    key(blocks[1]!, "ArrowDown", { altKey: true });
    expect(blocks[4]!.classList.contains("is-active")).toBe(true);
    key(blocks[4]!, "ArrowUp", { altKey: true });
    expect(blocks[0]!.classList.contains("is-active")).toBe(true);
    key(blocks[0]!, "End");
    expect(blocks[4]!.classList.contains("is-active")).toBe(true);
    key(blocks[4]!, "Home");
    expect(blocks[0]!.classList.contains("is-active")).toBe(true);
    key(blocks[0]!, "ArrowUp");
    expect(blocks[0]!.classList.contains("is-active")).toBe(true);
    expect(calls.revealed.every(([, , , focus]) => !focus)).toBe(true);
    key(blocks[0]!, "Enter");
    expect(calls.revealed.at(-1)).toEqual(["Novel/Part One/01 Chapter One.md", 0, 0, true]);
  });

  it("returns from the editor to the paragraph holding the cursor", async () => {
    const { v } = open(notes());
    await v.onOpen();
    v.focusAt("Novel/Part One/01 Chapter One.md", 4);
    const blocks = v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block");
    expect(blocks[3]!.classList.contains("is-active")).toBe(true);
    expect(document.activeElement).toBe(blocks[3]);
    v.focusAt("Novel/Part One/01 Chapter One.md", 2);
    expect(blocks[2]!.classList.contains("is-active")).toBe(true);
  });

  it("follows internal links instead of selecting", async () => {
    const { v, calls } = open(notes(), { render: async (_md, el) => { const a = el.createEl("a", { text: "Ilse", cls: "internal-link" }); a.setAttribute("data-href", "Ilse"); } });
    await v.onOpen();
    click(v.contentEl.querySelector<HTMLElement>("a.internal-link")!);
    expect(calls.links).toEqual(["Ilse"]);
    expect(calls.revealed).toEqual([]);
  });

  it("re-renders only the note whose text changed and keeps the selection", async () => {
    const { v, calls, notes: n } = open(notes());
    await v.onOpen();
    click(v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block")[1]!);
    const before = calls.renders;
    const [one] = v.contentEl.querySelectorAll(".czm-ms-note");
    n[1] = { ...n[1]!, text: "Two, revised." };
    await v.refresh();
    expect(calls.renders - before).toBe(1);
    expect(v.contentEl.querySelectorAll(".czm-ms-note")[0]).toBe(one);
    expect(v.contentEl.querySelectorAll(".czm-ms-note")[1]!.textContent).toContain("Two, revised.");
    expect(v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block")[1]!.classList.contains("is-active")).toBe(true);
  });

  it("toggles prose only from the toolbar and remembers it", async () => {
    const { v } = open([{ path: "Novel/One.md", frontmatter: {}, text: "Text.\n\n- list" }]);
    await v.onOpen();
    expect(v.contentEl.querySelectorAll(".czm-ms-block")).toHaveLength(2);
    click(v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-tool")[0]!);
    await tick();
    expect(v.contentEl.querySelectorAll(".czm-ms-block")).toHaveLength(1);
    expect(v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-tool")[0]!.classList.contains("is-active")).toBe(true);
  });

  it("writes a comment from one field: a tag prefix, Enter to save, focus kept", async () => {
    const text = "Marta woke. %% CHECK: the coat %% She ==stayed==.\n\n%%\nTODO: a whole block\n%%\n\nEnd. %% untagged %%";
    const { v, calls } = open([{ path: "Novel/One.md", frontmatter: {}, text }]);
    await v.onOpen();
    const el = v.contentEl;
    const blocks = el.querySelectorAll<HTMLElement>(".czm-ms-block");
    expect([...blocks].map((b) => b.querySelectorAll(".czm-ms-mark").length)).toEqual([3, 1]);
    expect(blocks[0]!.querySelector<HTMLElement>(".czm-ms-mark")!.title).toBe("CHECK: the coat");
    const side = el.querySelector<HTMLElement>(".czm-ms-side")!;
    const field = () => side.querySelector<HTMLTextAreaElement>(".czm-ms-compose-text")!;
    expect(field().disabled).toBe(true);
    expect(side.querySelector(".czm-ms-compose-where")?.textContent).toContain("Click a paragraph");

    key(blocks[0]!, "c");
    expect(document.activeElement).toBe(field());
    expect(side.querySelector(".czm-ms-side-excerpt")?.textContent).toBe("Marta woke. She stayed.");
    expect([...side.querySelectorAll(".czm-ms-side-para .czm-ms-cm-badge:not(.czm-ms-compose-chip):not(.czm-ms-legend-chip)")].map((b) => b.textContent)).toEqual(["CHECK", "mark", "TODO"]);
    expect(side.querySelector(".czm-ms-compose-where")?.textContent).toContain("end of this paragraph in One");

    field().value = "FIX: tighten this";
    field().dispatchEvent(new Event("input"));
    const chip = side.querySelector<HTMLElement>(".czm-ms-compose-chip")!;
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toBe("FIX");
    expect(chip.style.getPropertyValue("--czm-tag")).toBe("#d64545");
    key(field(), "Enter", { shiftKey: true });
    expect(calls.comments).toEqual([]);
    key(field(), "Enter");
    await tick();
    expect(calls.comments).toEqual([["Novel/One.md", 0, "FIX: tighten this"]]);
    expect(field().value).toBe("");
    expect(document.activeElement).toBe(field());

    field().value = "draft";
    field().dispatchEvent(new Event("input"));
    key(field(), "Escape");
    expect(field().value).toBe("");
    key(field(), "Escape");
    expect(document.activeElement).toBe(blocks[0]);

    click(side.querySelector<HTMLElement>(".czm-ms-legend-chip")!);
    expect(field().value).toBe("TODO: ");
  });

  it("lists every comment, filters by tag, and is keyboard navigable", async () => {
    const text = "Marta woke. %% CHECK: the coat %% She ==stayed==.\n\nEnd. %% untagged %%";
    const { v, calls } = open([{ path: "Novel/One.md", frontmatter: {}, text }]);
    await v.onOpen();
    const all = () => v.contentEl.querySelector<HTMLElement>(".czm-ms-side-all")!;
    const rows = () => [...all().querySelectorAll<HTMLElement>(".czm-ms-cm-row")];
    expect(rows().map((r) => r.querySelector(".czm-ms-cm-badge")?.textContent)).toEqual(["CHECK", "mark", "note"]);
    expect(rows().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    rows()[0]!.focus();
    key(rows()[0]!, "ArrowDown");
    expect(document.activeElement).toBe(rows()[1]);
    key(rows()[1]!, "Enter");
    expect(calls.revealed.at(-1)).toEqual(["Novel/One.md", 0, 38, true]);
    const filter = all().querySelector<HTMLSelectElement>("select")!;
    expect([...filter.options].map((o) => o.text)).toEqual(["All", "Untagged (1)", "Highlights (1)", "CHECK (1)"]);
    filter.value = "CHECK";
    filter.dispatchEvent(new Event("change"));
    expect(rows()).toHaveLength(1);
    click(v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-tool")[1]!);
    await tick();
    expect(v.contentEl.querySelector<HTMLElement>(".czm-ms-side")!.hidden).toBe(true);
    expect(v.contentEl.querySelectorAll(".czm-ms-mark")).toHaveLength(3);
  });

  it("shows a paragraph's comments in a box after a hover pause, and on focus", async () => {
    const { v } = open([{ path: "Novel/One.md", frontmatter: {}, text: "Plain.\n\nMarked. %% TODO: x %%" }]);
    await v.onOpen();
    const [plain, marked] = v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block");
    const pop = v.contentEl.querySelector<HTMLElement>(".czm-ms-pop")!;
    marked!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(pop.hidden).toBe(true);
    await new Promise((r) => setTimeout(r, 250));
    expect(pop.hidden).toBe(false);
    expect(pop.textContent).toContain("TODO");
    plain!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(pop.hidden).toBe(true);
    marked!.focus();
    marked!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(pop.hidden).toBe(false);
    marked!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(pop.hidden).toBe(true);
  });

  it("exports from the toolbar", async () => {
    const { v, calls } = open(notes());
    await v.onOpen();
    click(v.contentEl.querySelector<HTMLElement>(".czm-ms-export")!);
    await tick();
    expect(calls.exported).toEqual(["Novel"]);
  });

  it("explains an empty project and a missing one", async () => {
    const { v } = open([{ path: "Novel/Outline.md", frontmatter: {}, text: "- beats only" }]);
    await v.onOpen();
    expect(v.contentEl.querySelector(".czm-ms-hint")?.textContent).toContain("Nothing to read yet");
    const none = open([], { projects: () => [], activeProject: () => null });
    await none.v.onOpen();
    expect(none.v.contentEl.textContent).toContain("No project yet");
  });
});
