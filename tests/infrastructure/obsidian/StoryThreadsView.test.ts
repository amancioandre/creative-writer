import { describe, it, expect } from "vitest";
import { WorkspaceLeaf, Setting } from "obsidian";
import { STORY_THREADS_VIEW_TYPE, StoryThreadsView, sceneLink, type StoryThreadsSource } from "../../../src/infrastructure/obsidian/views/StoryThreadsView";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_STORY_COLORS, DEFAULT_THREADS, type ThreadsSettings } from "../../../src/domain/settings/Settings";
import type { Contradiction, SceneSlot, Thread, ThreadModel } from "../../../src/domain/threads/Thread";
import { computeStrips } from "../../../src/domain/threads/Strips";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const ref = (path: string, title: string, line = 0) => ({ path, title, line });
const scenes: SceneSlot[] = [
  { ref: ref("Novel/One.md", "Camp"), index: 0, words: 800, start: 0, note: "Novel/One.md", bookmarked: false },
  { ref: ref("Novel/One.md", "Creek", 20), index: 1, words: 400, start: 800, note: "Novel/One.md", bookmarked: true },
  { ref: ref("Novel/Two.md", "Return"), index: 2, words: 600, start: 1200, note: "Novel/Two.md", bookmarked: false },
  { ref: ref("Novel/Two.md", "Night", 30), index: 3, words: 200, start: 1800, note: "Novel/Two.md", bookmarked: false },
];
const stop = (i: number, note = "", extra: Partial<Thread["refs"][number]> = {}) => ({ scene: scenes[i]!.ref, index: i, note, ...extra });
const ilse: Thread = { id: "entity:Novel/Characters/Ilse.md", kind: "entity", source: "structure", label: "Ilse", entityId: "Novel/Characters/Ilse.md", entityKind: "character", refs: [stop(0), stop(1), stop(3)], stale: false };
const eyes: Thread = { id: "fact:ilse|eye colour", kind: "fact", source: "model", label: "Ilse · eye colour", refs: [stop(1, "green", { value: "green", evidence: "her green eyes" }), stop(3, "grey", { value: "grey", evidence: "grey eyes now" })], stale: false };
const letter: Thread = { id: "writer:the letter", kind: "writer", source: "writer", label: "The letter", refs: [stop(0, "planted"), stop(2, "paid off"), { scene: ref("Nine", "Nowhere"), index: -1, note: "?", unresolved: "Nine#Nowhere" }], stale: false };
const clash: Contradiction = { key: "K", threadId: eyes.id, subject: "Ilse", attribute: "eye colour", a: eyes.refs[0]!, b: eyes.refs[1]!, dismissed: false, stale: false };

function model(overrides: Partial<ThreadModel> = {}): ThreadModel {
  const threads = overrides.threads ?? [ilse, eyes, letter];
  const contradictions = overrides.contradictions ?? [clash];
  const timeline = scenes.map((s) => ({ scene: s.ref, words: s.words, bookmarked: s.bookmarked, present: [] as string[], events: [] as string[] }));
  return { project: "Novel", scenes, threads, contradictions, strips: computeStrips(scenes, timeline, threads, contradictions), factsRead: 2, ...overrides };
}

function source(overrides: Partial<StoryThreadsSource> = {}, m: ThreadModel = model()) {
  const calls = { opened: [] as string[], revealed: [] as string[], dismissed: [] as string[], undismissed: [] as string[], added: [] as string[], removed: [] as string[], read: [] as (string | null)[], map: 0 };
  let current = m;
  let settings: ThreadsSettings = DEFAULT_THREADS;
  const src: StoryThreadsSource = {
    projects: () => [novel],
    activeProject: () => novel,
    activeNotePath: () => "Novel/One.md",
    build: async () => current,
    openNote: (p) => { calls.opened.push(p); },
    reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); },
    readFacts: async (_p, path) => { calls.read.push(path); return 1; },
    dismiss: async (_p, key) => { calls.dismissed.push(key); current = { ...current, contradictions: current.contradictions.map((c) => (c.key === key ? { ...c, dismissed: true } : c)) }; },
    undismiss: async (_p, key) => { calls.undismissed.push(key); current = { ...current, contradictions: current.contradictions.map((c) => (c.key === key ? { ...c, dismissed: false } : c)) }; },
    addToThread: async (_p, thread, link, note) => { calls.added.push(`${thread} <- ${link}${note ? ` (${note})` : ""}`); },
    removeFromThread: async (_p, thread, link) => { calls.removed.push(`${thread} -x ${link}`); },
    threadsNotePath: () => "Novel/Story threads.md",
    storyColors: () => DEFAULT_STORY_COLORS,
    settings: () => settings,
    updateSettings: (next) => { settings = next; },
    openMap: () => { calls.map++; },
    ...overrides,
  };
  return { src, calls, settings: () => settings };
}

async function open(overrides: Partial<StoryThreadsSource> = {}, m?: ThreadModel) {
  Setting.created = [];
  const s = source(overrides, m);
  const v = new StoryThreadsView(new WorkspaceLeaf(), s.src);
  await v.onOpen();
  return { v, calls: s.calls, el: v.contentEl, settings: s.settings };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const setting = (cls: string) => Setting.created.find((s) => s.settingEl.classList.contains(cls))!;
const arcs = (el: HTMLElement) => [...el.querySelectorAll<SVGPathElement>(".czm-arc")];
const click = (node: Element) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("StoryThreadsView", () => {
  it("has a stable type, an icon, and names the project", async () => {
    const { v } = await open();
    expect(v.getViewType()).toBe(STORY_THREADS_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Story threads");
    expect(v.getIcon()).toBe("spline");
  });

  it("draws one bar per scene, arcs for facts and hand-drawn threads by default, and the contradiction on top in red", async () => {
    const { el } = await open();
    const bars = [...el.querySelectorAll(".czm-th-bar")];
    expect(bars).toHaveLength(4);
    expect(bars[1]!.classList.contains("is-bookmarked")).toBe(true);
    expect(bars.map((b) => b.classList.contains("czm-th-shade-1"))).toEqual([false, false, true, true]);
    // Entity threads are off by default: one fact arc, one writer arc (the broken stop draws nothing), one contradiction arc.
    const drawn = arcs(el);
    expect(drawn.map((a) => a.getAttribute("class"))).toEqual(["czm-arc czm-arc-fact", "czm-arc czm-arc-writer", "czm-arc czm-arc-fact is-contradiction"]);
    expect(drawn[2]!.getAttribute("d")).toBe(drawn[0]!.getAttribute("d"));
    expect(el.querySelector(".czm-th-badge")!.textContent).toBe("1 contradiction");
    expect(el.querySelector(".czm-th-badge")!.classList.contains("is-alert")).toBe(true);
    expect(el.querySelectorAll(".czm-th-strip-label").length).toBeGreaterThan(3);
    expect(el.querySelector(".czm-th-broken")!.textContent).toContain("Nine#Nowhere");
  });

  it("switches entity threads on from the panel, colours them by kind, and persists the choice", async () => {
    const { el, settings } = await open();
    setting("czm-set-thread-entity").toggle!.onChangeCb(true);
    const entity = arcs(el).filter((a) => a.classList.contains("czm-arc-entity"));
    expect(entity).toHaveLength(2);
    expect(entity[0]!.style.getPropertyValue("--czm-kind")).toBe(DEFAULT_STORY_COLORS.character);
    await new Promise((r) => setTimeout(r, 450));
    expect(settings().kinds.entity).toBe(true);
  });

  it("follows one name through the picker even with entity threads off", async () => {
    const { el } = await open();
    const pick = el.querySelector(".czm-th-entity") as HTMLSelectElement;
    pick.value = "Novel/Characters/Ilse.md";
    pick.dispatchEvent(new Event("change"));
    expect(arcs(el).filter((a) => a.classList.contains("czm-arc-entity"))).toHaveLength(2);
    setting("czm-set-thread-fact").toggle!.onChangeCb(false);
    setting("czm-set-thread-writer").toggle!.onChangeCb(false);
    expect(arcs(el)).toHaveLength(2);
  });

  it("lifts a hovered arc and its kin, opens a card with both values and quotes on a contradiction, and dismisses it", async () => {
    const { el, calls } = await open();
    const red = el.querySelector(".czm-arc.is-contradiction")!;
    red.dispatchEvent(new Event("pointerenter"));
    expect(red.classList.contains("is-lifted")).toBe(true);
    expect(el.querySelector(".czm-arc-fact:not(.is-contradiction)")!.classList.contains("is-kin")).toBe(true);
    expect(el.querySelector(".czm-th-arcs")!.classList.contains("has-hover")).toBe(true);
    red.dispatchEvent(new Event("pointerleave"));
    expect(el.querySelector(".czm-th-arcs")!.classList.contains("has-hover")).toBe(false);
    click(red);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-map-card-name")!.textContent).toBe("Ilse · eye colour");
    expect(card.querySelector(".czm-map-conflict-text")!.textContent).toContain("“green” in one scene, “grey” in another");
    const quotes = [...card.querySelectorAll(".czm-th-quote")].map((q) => q.textContent);
    expect(quotes[0]).toContain("her green eyes");
    expect(quotes[1]).toContain("grey eyes now");
    click(card.querySelector(".czm-map-row")!);
    expect(calls.revealed).toEqual(["Creek@20"]);
    click(card.querySelector(".czm-act-dismiss")!);
    await tick(); await tick();
    expect(calls.dismissed).toEqual(["K"]);
    // Dismissed pairs are hidden until asked for; the badge says so.
    expect(el.querySelector(".czm-arc.is-contradiction")).toBeNull();
    expect(el.querySelector(".czm-th-badge")!.textContent).toBe("No contradictions · 2 scenes read");
    setting("czm-set-show-dismissed").toggle!.onChangeCb(true);
    const faded = el.querySelector(".czm-arc.is-contradiction")!;
    expect(faded.classList.contains("is-dismissed")).toBe(true);
    click(faded);
    click(el.querySelector(".czm-act-undismiss")!);
    await tick(); await tick();
    expect(calls.undismissed).toEqual(["K"]);
    expect(el.querySelector(".czm-arc.is-contradiction.is-dismissed")).toBeNull();
  });

  it("opens a scene card from a bar: threads through it, a way to the editor, and adding it to a thread", async () => {
    const { el, calls } = await open();
    click(el.querySelector('.czm-th-bar[data-index="2"]')!);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-map-card-name")!.textContent).toBe("Return");
    expect(card.textContent).toContain("600 words");
    expect([...card.querySelectorAll(".czm-map-row-name")].map((r) => r.textContent)).toEqual(["The letter"]);
    click(card.querySelector(".czm-act-reveal")!);
    expect(calls.revealed).toEqual(["Return@0"]);
    const pick = card.querySelector(".czm-th-add-pick") as HTMLSelectElement;
    expect([...pick.options].map((o) => o.textContent)).toEqual(["The letter", "New thread…"]);
    pick.value = " new";
    pick.dispatchEvent(new Event("change"));
    (card.querySelector(".czm-th-add-name") as HTMLInputElement).value = "The gate";
    (card.querySelector(".czm-th-add-note") as HTMLInputElement).value = "closes";
    click(card.querySelector(".czm-act-add-to-thread")!);
    await tick(); await tick();
    expect(calls.added).toEqual(["The gate <- Two#Return (closes)"]);
    // Clicking the same bar again closes the card; another bar opens its own, and a thread row there selects the arc.
    click(el.querySelector('.czm-th-bar[data-index="2"]')!);
    expect(el.querySelector(".czm-map-card.is-open")).toBeNull();
    click(el.querySelector('.czm-th-bar[data-index="0"]')!);
    click(el.querySelector(".czm-map-card .czm-map-row")!);
    expect(el.querySelector(".czm-arc.is-selected")!.classList.contains("czm-arc-writer")).toBe(true);
  });

  it("removes a stop from a hand-drawn thread and opens the note", async () => {
    const { el, calls } = await open();
    click(el.querySelector(".czm-arc-writer")!);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-map-kind")!.textContent).toBe("Yours");
    expect(card.textContent).toContain("All 3 stops");
    expect(card.querySelector(".czm-map-row.is-broken")!.textContent).toContain("Nine#Nowhere");
    click(card.querySelector(".czm-act-open-threads")!);
    expect(calls.opened).toEqual(["Novel/Story threads.md"]);
    click(card.querySelector(".czm-act-remove-stop")!);
    await tick(); await tick();
    expect(calls.removed).toEqual(["The letter -x One#Camp"]);
  });

  it("reads facts from the panel, the scene card, and the command; shows the model's own message when there is none", async () => {
    const { el, calls, v } = await open();
    click(el.querySelector(".czm-th-read")!);
    await tick(); await tick();
    expect(el.querySelector(".czm-map-status")!.textContent).toContain("Read 1 scene");
    click(el.querySelector('.czm-th-bar[data-index="1"]')!);
    click(el.querySelector(".czm-act-read-note")!);
    await tick(); await tick();
    await v.readActiveNote();
    expect(calls.read).toEqual([null, "Novel/One.md", "Novel/One.md"]);
    const { el: none } = await open({ readFacts: async () => { throw new Error("needs a local model"); } });
    click(none.querySelector(".czm-th-read")!);
    await tick(); await tick();
    expect(none.querySelector(".czm-map-status")!.textContent).toContain("needs a local model");
  });

  it("filters to contradictions, searches by label, and toggles strips", async () => {
    const { el } = await open();
    setting("czm-set-contradictions-only").toggle!.onChangeCb(true);
    expect(arcs(el).map((a) => a.classList.contains("czm-arc-fact"))).toEqual([true, true]);
    setting("czm-set-contradictions-only").toggle!.onChangeCb(false);
    const search = el.querySelector(".czm-map-search") as HTMLInputElement;
    search.value = "letter";
    search.dispatchEvent(new Event("input"));
    expect(arcs(el).map((a) => a.getAttribute("data-thread"))).toEqual(["writer:the letter"]);
    search.value = "";
    search.dispatchEvent(new Event("input"));
    const before = el.querySelectorAll(".czm-th-strip-label").length;
    setting("czm-set-strip-cast").toggle!.onChangeCb(false);
    expect(el.querySelectorAll(".czm-th-strip-label")).toHaveLength(before - 1);
  });

  it("zooms horizontally and fits back", async () => {
    const { el, v } = await open();
    const svg = el.querySelector("svg")!;
    const w0 = Number(svg.getAttribute("width"));
    v.zoomAt(0, 2);
    expect(Number(svg.getAttribute("width"))).toBeCloseTo(w0 * 2, 0);
    // Strips stay aligned with the bars at any zoom.
    const bar = el.querySelector('.czm-th-bar[data-index="2"]')!;
    const strip = el.querySelector('.czm-th-strip-bar.czm-th-strip-threads')!;
    expect(strip.getAttribute("x")).toBe(el.querySelector('.czm-th-bar[data-index="0"]')!.getAttribute("x"));
    expect(Number(bar.getAttribute("x"))).toBeGreaterThan(0);
    click(el.querySelector(".czm-map-fit")!);
    expect(Number(svg.getAttribute("width"))).toBe(w0);
    v.zoomAt(0, 0.1);
    expect(Number(svg.getAttribute("width"))).toBe(w0);
  });

  it("explains each empty state", async () => {
    const { el: noProject } = await open({ projects: () => [], activeProject: () => null });
    expect(noProject.querySelector(".czm-map-empty")!.textContent).toContain("No project yet");
    const { el: noScenes } = await open({}, { ...model(), scenes: [], threads: [], contradictions: [], strips: [], factsRead: 0 });
    expect(noScenes.querySelector(".czm-map-empty")!.textContent).toContain("No scenes yet");
    const { el: nothing } = await open({}, model({ threads: [], contradictions: [], factsRead: 0 }));
    expect(nothing.querySelector(".czm-map-empty")!.textContent).toContain("Nothing to draw yet");
    expect(nothing.querySelector(".czm-th-badge")!.classList.contains("is-open")).toBe(false);
    const { el: clean } = await open({}, model({ threads: [letter], contradictions: [] }));
    setting("czm-set-contradictions-only").toggle!.onChangeCb(true);
    expect(clean.querySelector(".czm-map-empty")!.textContent).toContain("No contradictions in the scenes read");
  });

  it("keeps a selection across a refresh when it still exists, and drops it otherwise", async () => {
    const { el, v } = await open();
    click(el.querySelector(".czm-arc-writer")!);
    await v.refresh();
    expect(el.querySelector(".czm-map-card.is-open")).not.toBeNull();
    await v.show({ ...novel, scope: "Other/", name: "Other" });
    expect(el.querySelector(".czm-map-card.is-open")).toBeNull();
    expect(v.getDisplayText()).toBe("Story threads");
  });

  it("names scenes the way Story threads.md does", () => {
    expect(sceneLink(ref("Novel/Chapter 3.md", "The station"))).toBe("Chapter 3#The station");
    expect(sceneLink(ref("Novel/Chapter 3.md", ""))).toBe("Chapter 3");
  });
});
