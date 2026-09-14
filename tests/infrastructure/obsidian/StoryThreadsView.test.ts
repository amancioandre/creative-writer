import { describe, it, expect } from "vitest";
import { WorkspaceLeaf, Setting } from "obsidian";
import { STORY_THREADS_VIEW_TYPE, StoryThreadsView, sceneLink, type StoryThreadsSource } from "../../../src/infrastructure/obsidian/views/StoryThreadsView";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_STORY_COLORS, DEFAULT_THREADS, type ThreadsSettings } from "../../../src/domain/settings/Settings";
import { echoThreadId, type Contradiction, type SceneSlot, type Thread, type ThreadModel } from "../../../src/domain/threads/Thread";
import { EMPTY_ECHOES } from "../../../src/domain/echoes/Echoes";
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
const ilse: Thread = { id: "entity:Novel/Characters/Ilse.md", kind: "entity", source: "structure", label: "Ilse", entityId: "Novel/Characters/Ilse.md", entityKind: "character", refs: [stop(0), stop(1), stop(3)], stale: false, directed: false, dangling: [] };
const eyes: Thread = { id: "fact:ilse|eye colour", kind: "fact", source: "model", label: "Ilse · eye colour", refs: [stop(1, "green", { value: "green", evidence: "her green eyes" }), stop(3, "grey", { value: "grey", evidence: "grey eyes now" })], stale: false, directed: false, dangling: [] };
const letter: Thread = { id: "writer:the letter", kind: "writer", source: "writer", label: "The letter", refs: [stop(0, "planted"), stop(2, "paid off"), { scene: ref("Nine", "Nowhere"), index: -1, note: "?", unresolved: "Nine#Nowhere" }], stale: false, directed: false, dangling: [] };
const clash: Contradiction = { key: "K", threadId: eyes.id, subject: "Ilse", attribute: "eye colour", a: eyes.refs[0]!, b: eyes.refs[1]!, dismissed: false, stale: false };

function model(overrides: Partial<ThreadModel> = {}): ThreadModel {
  const threads = overrides.threads ?? [ilse, eyes, letter];
  const contradictions = overrides.contradictions ?? [clash];
  const timeline = scenes.map((s) => ({ scene: s.ref, words: s.words, bookmarked: s.bookmarked, present: [] as string[], events: [] as string[] }));
  return { project: "Novel", scenes, threads, contradictions, strips: computeStrips(scenes, timeline, threads, contradictions), factsRead: 2, echoes: EMPTY_ECHOES, semantic: { stored: 0, stale: 0 }, ...overrides };
}

function source(overrides: Partial<StoryThreadsSource> = {}, m: ThreadModel = model()) {
  const calls = { opened: [] as string[], revealed: [] as string[], dismissed: [] as string[], undismissed: [] as string[], added: [] as string[], stops: [] as string[], roles: [] as string[], removed: [] as string[], read: [] as (string | null)[], intent: [] as string[], echoes: 0, map: 0 };
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
    readIntent: async (_p, cs) => { calls.intent.push(...cs.map((c) => c.key)); return cs.length; },
    readEchoes: async () => { calls.echoes++; return 3; },
    dismiss: async (_p, key) => { calls.dismissed.push(key); current = { ...current, contradictions: current.contradictions.map((c) => (c.key === key ? { ...c, dismissed: true } : c)) }; },
    undismiss: async (_p, key) => { calls.undismissed.push(key); current = { ...current, contradictions: current.contradictions.map((c) => (c.key === key ? { ...c, dismissed: false } : c)) }; },
    addToThread: async (_p, thread, link, note) => { calls.added.push(`${thread} <- ${link}${note ? ` (${note})` : ""}`); },
    addStops: async (_p, thread, stops) => { calls.stops.push(`${thread}: ${stops.map((s) => `${s.role ?? "touch"} ${s.link} “${s.quote ?? ""}”`).join(" | ")}`); },
    setStopRole: async (_p, thread, link, role) => { calls.roles.push(`${thread} ${link} = ${role}`); },
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

  it("turns a contradiction into a reversal thread, anchored to both quotes", async () => {
    const { el, calls } = await open();
    click(el.querySelector(".czm-arc.is-contradiction")!);
    click(el.querySelector(".czm-act-reversal")!);
    await tick(); await tick();
    expect(calls.stops).toEqual(["Ilse's eye colour: plant One#Creek “her green eyes” | reversal Two#Night “grey eyes now”"]);
    expect(calls.dismissed).toEqual([]);
    expect(el.querySelector(".czm-map-status")!.textContent).toContain("is a reversal now");
  });

  it("hides an explained contradiction, draws its thread with an arrow and a stub for a loose plant, and offers the roles on the card", async () => {
    const plant = { ...stop(1, "", { role: "plant" as const, quote: "her green eyes", anchor: { line: 4, ch: 0 } }) };
    const reversal = { ...stop(3, "", { role: "reversal" as const, quote: "grey eyes now", anchor: null }) };
    const kept: Thread = { id: "writer:ilse's eye colour", kind: "writer", source: "writer", label: "Ilse's eye colour", refs: [plant, reversal], stale: false, directed: true, dangling: [] };
    const loose: Thread = { id: "writer:the gate", kind: "writer", source: "writer", label: "The gate", refs: [stop(0, "", { role: "plant" })], stale: false, directed: true, dangling: [stop(0, "", { role: "plant" })] };
    const { el, calls } = await open({}, model({ threads: [ilse, eyes, kept, loose], contradictions: [{ ...clash, explainedBy: kept.id }] }));
    expect(el.querySelector(".czm-arc.is-contradiction")).toBeNull();
    expect(el.querySelector(".czm-th-badge")!.textContent).toBe("No contradictions · 2 scenes read");
    expect(el.querySelector(".czm-th-clash-count")!.textContent).toBe("0 open, 0 dismissed, 1 reversal, in 2 scenes read.");
    expect(el.querySelector("marker#czm-th-arrow")).not.toBeNull();
    const directed = arcs(el).filter((a) => a.classList.contains("czm-arc-directed"));
    expect(directed.map((a) => a.classList.contains("is-dangling"))).toEqual([false, true]);
    expect(el.querySelector(".czm-th-unanchored")!.textContent).toBe("Ilse's eye colour: “grey eyes now” is no longer in Night.");
    expect(el.querySelector(".czm-th-dangling")!.textContent).toBe("The gate: planted in Camp, no payoff yet.");
    click(directed[0]!);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect([...card.querySelectorAll(".czm-th-role")].map((r) => r.textContent)).toEqual(["plant", "reversal"]);
    expect(card.querySelector(".czm-th-role-warn")!.textContent).toBe("quote not found");
    click(card.querySelector(".czm-act-payoff")!);
    await tick(); await tick();
    expect(calls.roles).toEqual(["Ilse's eye colour One#Creek = payoff"]);
    click(directed[1]!);
    const stubCard = el.querySelector(".czm-map-card.is-open")!;
    expect(stubCard.querySelector(".czm-th-dangling-note")).not.toBeNull();
    expect(stubCard.querySelector(".czm-act-payoff")).toBeNull();
  });

  it("draws echoes only when asked, follows one, explains it on the card, and keeps it as a motif", async () => {
    const salt = { key: "surface:salt on the wind", tier: "surface" as const, text: "salt on the wind", scenes: 2, nearest: 1, score: 2,
      stops: [{ scene: scenes[0]!.ref, index: 0, paragraph: 0, from: 10, to: 26, text: "salt on the wind", sentence: "There was salt on the wind." }, { scene: scenes[1]!.ref, index: 1, paragraph: 0, from: 4, to: 20, text: "salt on the wind", sentence: "Salt on the wind again." }] };
    const echo: Thread = { id: echoThreadId(salt.key), kind: "echo", source: "extracted", label: salt.text, refs: [stop(0, salt.stops[0]!.sentence, { quote: salt.text }), stop(1, salt.stops[1]!.sentence, { quote: salt.text })], stale: false, directed: false, dangling: [] };
    const { el, calls } = await open({}, model({ threads: [ilse, eyes, letter, echo], echoes: { groups: [salt], pairs: [] } }));
    expect(arcs(el).some((a) => a.classList.contains("czm-arc-echo"))).toBe(false);
    setting("czm-set-thread-echo").toggle!.onChangeCb(true);
    const drawn = arcs(el).filter((a) => a.classList.contains("czm-arc-echo"));
    expect(drawn).toHaveLength(1);
    expect(el.querySelector(".czm-th-badge")!.textContent).toBe("1 contradiction");
    click(drawn[0]!);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-map-kind")!.textContent).toBe("Echo");
    expect(card.querySelector(".czm-th-echo-verdict")!.textContent).toBe("A tic: “salt on the wind” 2 times, 1 scene apart.");
    expect([...card.querySelectorAll(".czm-th-quote.is-echo")].map((q) => q.textContent)).toEqual(["Camp: There was salt on the wind.", "Creek: Salt on the wind again."]);
    click(card.querySelector(".czm-act-motif")!);
    await tick(); await tick();
    expect(calls.stops).toEqual(["salt on the wind: touch One#Camp “salt on the wind” | touch One#Creek “salt on the wind”"]);
    // Follow one echo from the picker even with the kind off.
    setting("czm-set-thread-echo").toggle!.onChangeCb(false);
    const pick = el.querySelector(".czm-th-echo") as HTMLSelectElement;
    pick.value = echo.id;
    pick.dispatchEvent(new Event("change"));
    expect(arcs(el).filter((a) => a.classList.contains("czm-arc-echo"))).toHaveLength(1);
  });

  it("reads open contradictions for intent and the project for echoes from the panel, and shows the verdict on the card as a proposal", async () => {
    const { el, calls } = await open({}, model({ contradictions: [{ ...clash, intent: { verdict: "reversal", reason: "the dye is named", confidence: 0.8, model: "ollama:q" } }], semantic: { stored: 4, stale: 1 } }));
    click(el.querySelector(".czm-arc.is-contradiction")!);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-th-intent")!.textContent).toBe("The model reads this as a reversal: the dye is named (80%)");
    expect(card.querySelector(".czm-th-intent")!.classList.contains("is-reversal")).toBe(true);
    expect(card.querySelector(".czm-act-reversal")!.textContent).toBe("Accept as a reversal");
    expect(el.querySelector(".czm-th-semantic")!.textContent).toBe("4 sentence pairs from the model, 1 stale — read again.");
    click(el.querySelector(".czm-th-read-intent")!);
    await tick(); await tick();
    expect(calls.intent).toEqual(["K"]);
    expect(el.querySelector(".czm-map-status")!.textContent).toBe("Read 1 contradiction.");
    click(el.querySelector(".czm-th-read-echoes")!);
    await tick(); await tick();
    expect(calls.echoes).toBe(1);
    expect(el.querySelector(".czm-map-status")!.textContent).toBe("Found 3 sentence pairs that say the same thing.");
    const { el: none } = await open({}, model({ contradictions: [] }));
    click(none.querySelector(".czm-th-read-intent")!);
    await tick();
    expect(none.querySelector(".czm-map-status")!.textContent).toBe("No open contradictions to read.");
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
    // Undo writes the stop back, with its note.
    expect(el.querySelector(".czm-map-status")!.textContent).toContain("taken out of “The letter”");
    click(el.querySelector(".czm-status-undo")!);
    await tick(); await tick();
    expect(calls.stops).toHaveLength(1);
    expect(calls.stops[0]).toContain("The letter: ");
    expect(calls.stops[0]).toContain("One#Camp");
  });

  it("disables Add while a stop is being written, so a double click adds once", async () => {
    let release: () => void = () => undefined;
    const { el, calls } = await open({ addToThread: async (_p, thread, link) => { calls.added.push(`${thread} <- ${link}`); await new Promise<void>((r) => { release = r; }); } });
    click(el.querySelector(".czm-th-bar")!);
    const card = el.querySelector(".czm-map-card.is-open")!;
    const add = card.querySelector<HTMLButtonElement>(".czm-act-add-to-thread")!;
    click(add); click(add);
    expect(add.disabled).toBe(true);
    expect(calls.added).toHaveLength(1);
    release();
    await tick(); await tick();
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
