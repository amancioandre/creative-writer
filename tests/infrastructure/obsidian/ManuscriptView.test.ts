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
  const calls = { revealed: [] as [string, number, number][], links: [] as string[], renders: 0, exported: [] as string[], comments: [] as [string, number, string][] };
  let settings: ManuscriptSettings = DEFAULT_MANUSCRIPT;
  const src: ManuscriptSource = {
    projects: () => [novel],
    activeProject: () => novel,
    build: async () => buildManuscript(novel, notes, settings),
    render: async (md, el) => { calls.renders++; el.createEl("p").innerHTML = md.replace(/^#+\s*/, "").replace(/\*/g, ""); },
    segment: (t) => seg.segment(t),
    reveal: (p, l, c) => { calls.revealed.push([p, l, c]); },
    openLink: (l) => { calls.links.push(l); },
    settings: () => settings,
    updateSettings: (next) => { settings = next; },
    exportNote: async (p) => { calls.exported.push(p.name); return "Novel/Novel (manuscript).md"; },
    appendComment: async (p, l, c) => { calls.comments.push([p, l, c]); },
    ...overrides,
  };
  return { v: new ManuscriptView(new WorkspaceLeaf(), src), calls, notes };
}

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

  it("renders the outline, then the notes' blocks, and counts", async () => {
    const { v } = open(notes());
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-ms-head")?.textContent).toContain("2 notes · 14 words");
    expect([...el.querySelectorAll(".czm-ms-page > *")].map((n) => `${n.tagName}.${n.className.split(" ")[0]}`)).toEqual(["H1.czm-ms-folder", "DIV.czm-ms-note", "DIV.czm-ms-note"]);
    expect(el.querySelector(".czm-ms-folder")?.textContent).toBe("Part One");
    const one = el.querySelector(".czm-ms-note")!;
    expect(one.querySelector(".czm-ms-title")).toBeNull();
    expect([...one.querySelectorAll(".czm-ms-block")].map((b) => b.getAttribute("data-line"))).toEqual(["0", "1", "3", "4"]);
    expect(one.querySelector(".czm-ms-heading p")?.textContent).toBe("Chapter One");
    const two = el.querySelectorAll(".czm-ms-note")[1]!;
    expect(two.querySelector(".czm-ms-title")?.textContent).toBe("Chapter Two1 w");
  });

  it("opens the note at the clicked sentence, or at the top from a title", async () => {
    const { v, calls } = open(notes());
    await v.onOpen();
    const blocks = v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block");
    const creek = blocks[3]!;
    const text = creek.querySelector("p")!.firstChild as Text;
    const original = document.caretRangeFromPoint;
    document.caretRangeFromPoint = () => { const r = document.createRange(); r.setStart(text, text.data.indexOf("stayed")); return r; };
    creek.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls.revealed).toEqual([["Novel/Part One/01 Chapter One.md", 4, "Ilse found the creek. ".length]]);
    document.caretRangeFromPoint = original;
    blocks[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    v.contentEl.querySelector<HTMLElement>(".czm-ms-title")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls.revealed.slice(1)).toEqual([["Novel/Part One/01 Chapter One.md", 0, 2], ["Novel/Part One/02 Chapter Two.md", 0, 0]]);
  });

  it("follows internal links instead of jumping", async () => {
    const { v, calls } = open(notes(), { render: async (_md, el) => { const a = el.createEl("a", { text: "Ilse", cls: "internal-link" }); a.setAttribute("data-href", "Ilse"); } });
    await v.onOpen();
    v.contentEl.querySelector<HTMLElement>("a.internal-link")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls.links).toEqual(["Ilse"]);
    expect(calls.revealed).toEqual([]);
  });

  it("re-renders only the note whose text changed", async () => {
    const { v, calls, notes: n } = open(notes());
    await v.onOpen();
    const before = calls.renders;
    const [one] = v.contentEl.querySelectorAll(".czm-ms-note");
    n[1] = { ...n[1]!, text: "Two, revised." };
    await v.refresh();
    expect(calls.renders - before).toBe(1);
    expect(v.contentEl.querySelectorAll(".czm-ms-note")[0]).toBe(one);
    expect(v.contentEl.querySelectorAll(".czm-ms-note")[1]!.textContent).toContain("Two, revised.");
  });

  it("toggles prose only and remembers it", async () => {
    const { v, calls } = open([{ path: "Novel/One.md", frontmatter: {}, text: "Text.\n\n- list" }]);
    await v.onOpen();
    expect(v.contentEl.querySelectorAll(".czm-ms-block")).toHaveLength(2);
    const box = v.contentEl.querySelector<HTMLInputElement>(".czm-ms-head input")!;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(v.contentEl.querySelectorAll(".czm-ms-block")).toHaveLength(1);
    expect(calls.renders).toBeGreaterThan(2);
  });

  it("keeps the active paragraph's comments in the pane, adds one to its end, and lists them all", async () => {
    const text = "Marta woke. %% CHECK: the coat %% She ==stayed==.\n\n%%\nTODO: a whole block\n%%\n\nEnd. %% untagged %%";
    const { v, calls } = open([{ path: "Novel/One.md", frontmatter: {}, text }]);
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-ms-head")?.textContent).toContain("Comments (4)");
    const blocks = el.querySelectorAll<HTMLElement>(".czm-ms-block");
    expect([...blocks].map((b) => b.querySelectorAll(".czm-ms-mark").length)).toEqual([3, 1]);
    expect(blocks[0]!.querySelector<HTMLElement>(".czm-ms-mark")!.style.getPropertyValue("--czm-tag")).toBe("#4a8fe2");
    const side = el.querySelector<HTMLElement>(".czm-ms-side")!;
    expect(side.hidden).toBe(false);
    expect(side.querySelector(".czm-ms-side-para")?.textContent).toContain("Click a paragraph");
    expect([...side.querySelectorAll(".czm-ms-side-all .czm-ms-cm-badge")].map((b) => b.textContent)).toEqual(["CHECK", "==", "TODO", "%%"]);

    blocks[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(blocks[0]!.classList.contains("is-active")).toBe(true);
    const para = side.querySelector<HTMLElement>(".czm-ms-side-para")!;
    expect(para.querySelector(".czm-ms-side-excerpt")?.textContent).toBe("Marta woke. She ==stayed==.");
    expect([...para.querySelectorAll(".czm-ms-cm-badge")].map((b) => b.textContent)).toEqual(["CHECK", "==", "TODO"]);
    para.querySelector<HTMLElement>(".czm-ms-cm-row")!.click();
    expect(calls.revealed.at(-1)).toEqual(["Novel/One.md", 0, 12]);

    const tag = para.querySelector<HTMLSelectElement>("select")!;
    tag.value = "FIX";
    tag.dispatchEvent(new Event("change"));
    const box = para.querySelector<HTMLTextAreaElement>("textarea")!;
    box.value = "  tighten this  ";
    box.dispatchEvent(new Event("input"));
    para.querySelector<HTMLButtonElement>("button.mod-cta")!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.comments).toEqual([["Novel/One.md", 0, "FIX: tighten this"]]);

    const filter = side.querySelector<HTMLSelectElement>(".czm-ms-side-all select")!;
    expect([...filter.options].map((o) => o.text)).toEqual(["All", "Untagged (1)", "Highlights (1)", "CHECK (1)", "TODO (1)"]);
    filter.value = "TODO";
    filter.dispatchEvent(new Event("change"));
    expect(el.querySelectorAll(".czm-ms-side-all .czm-ms-cm-row")).toHaveLength(1);

    const toggle = el.querySelectorAll<HTMLInputElement>(".czm-ms-head input")[1]!;
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(el.querySelector<HTMLElement>(".czm-ms-side")!.hidden).toBe(true);
    expect(el.querySelectorAll(".czm-ms-mark")).toHaveLength(4);
  });

  it("shows a paragraph's comments in a box on hover", async () => {
    const { v } = open([{ path: "Novel/One.md", frontmatter: {}, text: "Plain.\n\nMarked. %% TODO: x %%" }]);
    await v.onOpen();
    const [plain, marked] = v.contentEl.querySelectorAll<HTMLElement>(".czm-ms-block");
    const pop = v.contentEl.querySelector<HTMLElement>(".czm-ms-pop")!;
    marked!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(pop.hidden).toBe(false);
    expect(pop.textContent).toContain("TODO");
    expect(pop.textContent).toContain("x");
    plain!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(pop.hidden).toBe(true);
  });

  it("exports on request and says where the note went", async () => {
    const { v, calls } = open(notes());
    await v.onOpen();
    const btn = v.contentEl.querySelector<HTMLButtonElement>(".czm-ms-export")!;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.exported).toEqual(["Novel"]);
    expect(btn.textContent).toBe("Exported: Novel (manuscript).md");
    expect(btn.disabled).toBe(false);
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
