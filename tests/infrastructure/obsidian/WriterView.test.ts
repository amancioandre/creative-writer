import { describe, it, expect } from "vitest";
import { Setting, WorkspaceLeaf } from "obsidian";
import { WRITER_VIEW_TYPE, WriterView, type WriterSource } from "../../../src/infrastructure/obsidian/views/WriterView";
import { type WriterNote, buildBoard } from "../../../src/domain/writer/Board";
import { EMPTY_WRITER_FILE, type WriterFile, placeGroup } from "../../../src/domain/writer/WriterFile";
import { CARD_H, CARD_W, GROUP_HEAD, GROUP_PAD, layoutBoard } from "../../../src/domain/writer/Layout";
import { DEFAULT_WRITER, type WriterSettings } from "../../../src/domain/settings/Settings";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { EMPTY_STORIES, type StoriesRow, type StoryCard } from "../../../src/domain/writer/Stories";

const bear: ProjectSpec = { name: "The Bear Hunt", notePath: "storytelling/Bear/Bear.md", scope: "storytelling/Bear/", targetWords: 1000, deadline: null, dailyWords: 0, ignoredNames: [] };
const bearCard: StoryCard = { spec: bear, stage: "drafting", declared: false, premise: "A man hunts a bear.", idea: "notes/Idea.md", voice: null, words: 120, target: 1000, cast: 3, lastWorked: "2026-09-01" };

const note = (path: string, tags: string[], links: string[] = [], excerpt = ""): WriterNote => ({ path, title: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), tags, links, excerpt });
const baseNotes: WriterNote[] = [
  note("notes/Courage.md", ["#writer/theme"], ["sources/Invictus.md"], "Courage is what is left."),
  note("sources/Invictus.md", ["#writer/poem", "#writer/quote"], [], "Out of the night"),
  note("notes/Wild.md", ["#writer/wildcard"]),
];

function source(overrides: Partial<WriterSource> = {}, notes: WriterNote[] = baseNotes, initial: WriterFile = EMPTY_WRITER_FILE, stories: StoriesRow = EMPTY_STORIES) {
  let file = initial;
  let settings: WriterSettings = DEFAULT_WRITER;
  let tagged = notes;
  let row = stories;
  const calls = { opened: [] as string[], retags: [] as string[], created: [] as string[], schema: 0, picks: [] as (string | null)[], stages: [] as string[], promoted: [] as string[], declared: [] as string[], views: [] as string[] };
  const src: WriterSource = {
    build: async () => ({ board: buildBoard(tagged, file), file, stories: row }),
    setStage: async (spec, stage) => { calls.stages.push(`${spec.name}: ${stage ?? "inferred"}`); row = { ...row, stories: row.stories.map((s) => s.spec === spec ? { ...s, stage: stage ?? "development", declared: !!stage } : s) }; },
    promote: async (idea, name, folder) => {
      calls.promoted.push(`${idea?.path ?? "∅"} -> ${folder}/${name}`);
      const spec: ProjectSpec = { ...bear, name, notePath: `${folder}/${name}/${name}.md`, scope: `${folder}/${name}/` };
      row = { ...row, stories: [...row.stories, { ...bearCard, spec, stage: "development", idea: idea?.path ?? null }], ideas: row.ideas.filter((c) => c.path !== idea?.path) };
      if (idea) tagged = tagged.map((n) => n.path === idea.path ? { ...n, story: spec.notePath } : n);
      return spec.notePath;
    },
    declare: async (folder) => { calls.declared.push(folder); row = { ...row, unfiled: row.unfiled.filter((f) => f !== folder) }; },
    openStory: (view, spec) => { calls.views.push(`${view}:${spec.name}`); },
    storiesFolder: () => "storytelling",
    update: async (change) => { file = change(file); return file; },
    filePath: () => "storytelling/Writer.writer",
    openNote: (p) => { calls.opened.push(p); },
    retag: async (path, from, to) => {
      calls.retags.push(`${path}: ${from ?? "∅"} -> ${to ?? "∅"}`);
      if (!tagged.some((n) => n.path === path)) tagged = [...tagged, note(path, [])];
      tagged = tagged.map((n) => n.path !== path ? n : { ...n, tags: [...n.tags.filter((t) => !from || t !== `#writer/${from}`), ...(to ? [`#writer/${to}`] : [])] });
    },
    pickNote: async () => { const p = calls.picks.shift() ?? null; return p; },
    createNote: async (title, group) => { const p = `new/${title}.md`; calls.created.push(`${group}:${title}`); tagged = [...tagged, note(p, [`#writer/${group}`])]; return p; },
    copySchema: async () => { calls.schema++; },
    settings: () => settings,
    updateSettings: (next) => { settings = next; },
    ...overrides,
  };
  return { src, calls, file: () => file, settings: () => settings };
}

async function open(overrides: Partial<WriterSource> = {}, notes?: WriterNote[], initial?: WriterFile, stories?: StoriesRow) {
  Setting.created = [];
  const s = source(overrides, notes, initial, stories);
  const v = new WriterView(new WorkspaceLeaf(), s.src);
  await v.onOpen();
  return { v, ...s, el: v.contentEl };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const press = (el: Element, x = 0, y = 0) => el.dispatchEvent(new MouseEvent("pointerdown", { clientX: x, clientY: y, bubbles: true }));
const move = (el: Element, x: number, y: number) => el.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
const release = (el: Element, x = 0, y = 0) => el.dispatchEvent(new MouseEvent("pointerup", { clientX: x, clientY: y, bubbles: true }));
const card = (el: HTMLElement, path: string) => el.querySelector<SVGGElement>(`.czm-writer-card[data-path="${path}"]`)!;
/** The board is fitted into jsdom's 800×600 fallback, so a screen delta is a graph delta times the zoom. */
const zoom = (v: WriterView) => (v as unknown as { canvas: { view: { k: number } } }).canvas.view.k;
const flush = (v: WriterView) => (v as unknown as { flushFile: () => Promise<void> }).flushFile();
const group = (el: HTMLElement, id: string) => el.querySelector<SVGGElement>(`.czm-writer-group[data-id="${id}"]`)!;

describe("WriterView", () => {
  it("draws every group of the framework, cards once in their first group, hints in empty groups and lines between linked cards", async () => {
    const { v, el } = await open();
    expect(v.getViewType()).toBe(WRITER_VIEW_TYPE);
    expect(v.getState()).toEqual({ file: "storytelling/Writer.writer" });
    expect(el.querySelectorAll(".czm-writer-group").length).toBe(18);
    expect(el.querySelectorAll(".czm-writer-card").length).toBe(3);
    expect(group(el, "theme").querySelector(".czm-writer-group-name")!.textContent).toBe("Themes · 1");
    expect(group(el, "genre").classList.contains("is-empty")).toBe(true);
    expect(group(el, "genre").querySelector(".czm-writer-hint-text")!.textContent).toContain("genres");
    expect(group(el, "unsorted")).not.toBeNull();
    expect(card(el, "sources/Invictus.md").querySelectorAll(".czm-writer-chip").length).toBe(2);
    expect(card(el, "sources/Invictus.md").querySelector(".czm-writer-card-title")!.textContent).toBe("Invictus");
    expect(el.querySelectorAll(".czm-writer-edge").length).toBe(1);
    expect(el.querySelectorAll(".czm-writer-layer").length).toBe(7); // six layers and the stories band
  });
  it("selects a card on click, shows its groups and links in the side card, and opens the note on double click", async () => {
    const { el, calls } = await open();
    const c = card(el, "sources/Invictus.md");
    press(c); release(c);
    expect(c.classList.contains("is-selected")).toBe(true);
    const side = el.querySelector(".czm-writer-side")!;
    expect(side.classList.contains("is-open")).toBe(true);
    expect(side.querySelector(".czm-map-card-name")!.textContent).toBe("Invictus");
    expect([...side.querySelectorAll(".czm-writer-chip-label")].map((x) => x.textContent)).toEqual(["Poems", "Quotes"]);
    expect(side.querySelector(".czm-writer-excerpt")!.textContent).toBe("Out of the night");
    expect([...side.querySelectorAll(".czm-map-row-name")].map((x) => x.textContent)).toEqual(["Poems", "Quotes", "Courage"]);
    c.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(calls.opened).toEqual(["sources/Invictus.md"]);
    press(c); release(c);
    expect(side.classList.contains("is-open")).toBe(false);
  });
  it("moves a card's tag when it is dropped in another group, and only remembers the position when dropped on the background", async () => {
    const { v, el, calls, file } = await open();
    const layout = layoutBoard(buildBoard(baseNotes, EMPTY_WRITER_FILE));
    const from = layout.cards.get("notes/Courage.md")!;
    const target = layout.groups.find((g) => g.group.def.id === "world")!;
    const c = card(el, "notes/Courage.md");
    const k = zoom(v);
    const dx = (target.rect.x + GROUP_PAD - from.x) * k, dy = (target.rect.y + GROUP_HEAD + GROUP_PAD - from.y) * k;
    press(c, 0, 0); move(c, dx, dy); release(c, dx, dy);
    await tick(); await tick();
    expect(calls.retags).toEqual(["notes/Courage.md: theme -> world"]);
    // Stored relative to the group it landed in: the first grid slot.
    expect(file().cards["notes/Courage.md"]).toEqual({ x: GROUP_PAD, y: GROUP_HEAD + GROUP_PAD });
    expect(group(el, "world").querySelector(".czm-writer-group-name")!.textContent).toBe("Worlds · 1");

    const c2 = card(el, "sources/Invictus.md");
    press(c2, 0, 0); move(c2, 5000, 5000); release(c2, 5000, 5000);
    await tick(); await tick();
    expect(calls.retags).toHaveLength(1);
    expect(file().cards["sources/Invictus.md"]).toBeTruthy();
    expect(card(el, "sources/Invictus.md").classList.contains("is-pinned")).toBe(true);
  });
  it("rewrites the tag from what it is when the card sits in Unsorted", async () => {
    const { v, el, calls } = await open();
    const layout = layoutBoard(buildBoard(baseNotes, EMPTY_WRITER_FILE));
    const from = layout.cards.get("notes/Wild.md")!;
    const target = layout.groups.find((g) => g.group.def.id === "theme")!;
    const c = card(el, "notes/Wild.md");
    const k = zoom(v);
    const dx = (target.rect.x + GROUP_PAD + CARD_W - from.x) * k, dy = (target.rect.y + GROUP_HEAD + GROUP_PAD + CARD_H - from.y) * k;
    press(c, 0, 0); move(c, dx, dy); release(c, dx, dy);
    await tick(); await tick();
    expect(calls.retags).toEqual(["notes/Wild.md: wildcard -> theme"]);
  });
  it("reorders a dragged group within its row, writing the whole row, and never overlaps; resizing remembers the rectangle", async () => {
    const { v, el, file } = await open();
    const g = group(el, "theme");
    const k = zoom(v);
    // Drag Themes left past Genres: it becomes the first of the Wish list row.
    press(g, 0, 0); move(g, -2000 * k, 0); release(g, -2000 * k, 0);
    await tick(); await tick();
    expect(Object.keys(file().groups).sort()).toEqual(["archetype", "dialogue", "genre", "plot", "theme", "world"]);
    expect(file().groups.theme!.x).toBe(0);
    expect(file().cards["notes/Courage.md"]).toBeUndefined();
    const row = [...el.querySelectorAll<SVGRectElement>(".czm-writer-group-rect")].slice(0, 6).map((r) => ({ x: Number(r.getAttribute("x")), w: Number(r.getAttribute("width")) })).sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) expect(row[i]!.x).toBeGreaterThanOrEqual(row[i - 1]!.x + row[i - 1]!.w);
    expect(group(el, "theme").querySelector<SVGRectElement>(".czm-writer-group-rect")!.getAttribute("x")).toBe("0.0");
    const handle = group(el, "poem").querySelector(".czm-writer-resize")!;
    press(handle, 0, 0); move(handle, 300, 200); release(handle, 300, 200);
    await tick(); await tick();
    expect(file().groups.poem!.w).toBeGreaterThan(400);
  });
  it("selects a group on click and lets its colour be changed and reset from the side card", async () => {
    const { v, el, file } = await open();
    const g = group(el, "theme");
    press(g); release(g);
    const side = el.querySelector(".czm-writer-side")!;
    expect(side.querySelector(".czm-map-card-name")!.textContent).toBe("Themes");
    const input = side.querySelector<HTMLInputElement>(".czm-writer-colour")!;
    input.value = "#123456";
    input.dispatchEvent(new Event("input"));
    await flush(v);
    expect(file().colours.theme).toBe("#123456");
    expect(group(el, "theme").style.getPropertyValue("--czm-group")).toBe("#123456");
    (side.querySelector(".czm-act-reset-colour") as HTMLElement).click();
    await flush(v);
    expect(file().colours.theme).toBeUndefined();
  });
  it("adds an existing note to the chosen group, creates a new note in it, and copies the schema", async () => {
    const { el, calls } = await open();
    calls.picks.push("journal/Today.md");
    const into = el.querySelector<HTMLSelectElement>(".czm-writer-into")!;
    into.value = "voice";
    into.dispatchEvent(new Event("change"));
    (el.querySelector(".czm-writer-add") as HTMLElement).click();
    await tick(); await tick();
    expect(calls.retags).toEqual(["journal/Today.md: ∅ -> voice"]);
    expect(card(el, "journal/Today.md")).not.toBeNull();
    expect(card(el, "journal/Today.md").classList.contains("is-selected")).toBe(true);

    (el.querySelector(".czm-writer-new") as HTMLElement).click();
    const title = el.querySelector<HTMLInputElement>(".czm-writer-new-title")!;
    title.value = "The Narrator";
    (el.querySelector(".czm-act-create") as HTMLElement).click();
    await tick(); await tick();
    expect(calls.created).toEqual(["voice:The Narrator"]);
    expect(calls.opened).toEqual(["new/The Narrator.md"]);
    expect(card(el, "new/The Narrator.md")).not.toBeNull();

    (el.querySelector(".czm-writer-schema") as HTMLElement).click();
    expect(calls.schema).toBe(1);
  });
  it("switches framework, keeping cards whose tags the new one knows and sending the rest to Unsorted", async () => {
    const { el, file } = await open();
    const fw = el.querySelector<HTMLSelectElement>(".czm-writer-framework")!;
    fw.value = "generic";
    fw.dispatchEvent(new Event("change"));
    await tick(); await tick();
    expect(file().framework).toBe("generic");
    expect(el.querySelectorAll(".czm-writer-group").length).toBe(8);
    expect(group(el, "unsorted").querySelector(".czm-writer-group-name")!.textContent).toBe("Unsorted · 2");
  });
  it("dims cards that do not match the search and hides a layer from the panel", async () => {
    const { el } = await open();
    const search = el.querySelector<HTMLInputElement>(".czm-map-search")!;
    search.value = "invic";
    search.dispatchEvent(new Event("input"));
    expect(card(el, "notes/Courage.md").classList.contains("is-dim")).toBe(true);
    expect(card(el, "sources/Invictus.md").classList.contains("is-dim")).toBe(false);
    const wish = Setting.created.find((s) => s.name === "Wish list")!;
    wish.toggle!.onChangeCb(false);
    expect(card(el, "notes/Courage.md")).toBeNull();
    expect(el.querySelectorAll(".czm-writer-layer").length).toBe(6);
  });
  it("shows the empty-board hint when nothing is tagged, and restores a saved view instead of fitting", async () => {
    const { el } = await open({}, []);
    expect(el.querySelector(".czm-writer-empty")!.textContent).toContain("#writer/theme");
    expect(el.querySelectorAll(".czm-writer-card").length).toBe(0);
    const saved = { ...placeGroup(EMPTY_WRITER_FILE, "theme", { x: 5, y: 5, w: 500, h: 300 }), view: { x: 12, y: 34, k: 0.5 } };
    const { v } = await open({}, baseNotes, saved);
    expect((v as unknown as { canvas: { view: unknown } }).canvas.view).toEqual({ x: 12, y: 34, k: 0.5 });
  });
  it("folds the panel through the corner button", async () => {
    const { el, settings } = await open();
    (el.querySelector(".czm-map-icon") as HTMLElement).click();
    expect(settings().panelOpen).toBe(false);
    expect(el.querySelector(".czm-writer-panel")!.classList.contains("is-open")).toBe(false);
  });

  it("draws the stories band: a card per project with stage, premise and meta, idea and unfiled pills, and a hint when empty", async () => {
    const empty = await open();
    expect(empty.el.querySelector(".czm-writer-band .czm-writer-hint-text")!.textContent).toContain("No story yet");
    const ideaNote = note("notes/Idea.md", ["#writer/premise"], [], "A man hunts a bear. Then more.");
    const { el } = await open({}, [...baseNotes, ideaNote], undefined, { stories: [bearCard], ideas: [{ path: "notes/Other.md", title: "Other", story: null, groups: ["premise"], tagGroups: ["premise"], excerpt: "", position: null }], unfiled: ["storytelling/Loose"], uses: new Map() });
    const story = el.querySelector<SVGGElement>(".czm-writer-story")!;
    expect(story.getAttribute("data-scope")).toBe("storytelling/Bear/");
    expect(story.querySelector(".czm-writer-card-title")!.textContent).toBe("The Bear Hunt");
    expect(story.querySelector(".czm-writer-stage")!.textContent).toBe("Drafting");
    expect(story.querySelector(".czm-writer-story-premise")!.textContent).toBe("A man hunts a bear.");
    expect(story.querySelector(".czm-writer-story-meta")!.textContent).toBe("120 / 1,000 words · 3 in the cast · worked 2026-09-01");
    expect(el.querySelector(".czm-writer-band-name")!.textContent).toBe("Stories · 1");
    expect([...el.querySelectorAll(".czm-writer-pill text")].map((t) => t.textContent)).toEqual(["Idea · Other", "Unfiled · Loose"]);
  });
  it("selects a story: stage select, view buttons, links to the idea it grew from; double click opens the note", async () => {
    const ideaNote = note("notes/Idea.md", ["#writer/premise"], [], "A man hunts a bear.");
    const { el, calls } = await open({}, [...baseNotes, ideaNote], undefined, { stories: [bearCard], ideas: [], unfiled: [], uses: new Map() });
    const story = el.querySelector<SVGGElement>(".czm-writer-story")!;
    press(story); release(story);
    const side = el.querySelector(".czm-writer-side")!;
    expect(side.querySelector(".czm-map-card-name")!.textContent).toBe("The Bear Hunt");
    const select = side.querySelector<HTMLSelectElement>(".czm-writer-stage-select")!;
    expect(select.value).toBe("");
    select.value = "revising";
    select.dispatchEvent(new Event("change"));
    await tick(); await tick();
    expect(calls.stages).toEqual(["The Bear Hunt: revising"]);
    expect(el.querySelector(".czm-writer-story .czm-writer-stage")!.textContent).toBe("Revising");
    for (const v of ["map", "timeline", "threads", "manuscript", "desk"]) (el.querySelector(`.czm-act-story-${v}`) as HTMLElement).click();
    expect(calls.views).toEqual(["map:The Bear Hunt", "timeline:The Bear Hunt", "threads:The Bear Hunt", "manuscript:The Bear Hunt", "desk:The Bear Hunt"]);
    const grew = [...el.querySelectorAll(".czm-writer-side .czm-map-row")].find((r) => r.textContent!.includes("Grew from")) as HTMLElement;
    expect(grew.textContent).toContain("Idea");
    grew.click();
    expect(card(el, "notes/Idea.md").classList.contains("is-selected")).toBe(true);
    story.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(calls.opened).toEqual(["storytelling/Bear/Bear.md"]);
  });
  it("makes an idea a story from its card: the form, the promotion, the new story selected and its note opened", async () => {
    const ideaNote = note("notes/Idea.md", ["#writer/premise"], [], "A man hunts a bear.");
    const { el, calls } = await open({}, [...baseNotes, ideaNote], undefined, { stories: [], ideas: [{ path: "notes/Idea.md", title: "Idea", story: null, groups: ["premise"], tagGroups: ["premise"], excerpt: "A man hunts a bear.", position: null }], unfiled: [], uses: new Map() });
    const pill = el.querySelector<SVGGElement>(".czm-writer-pill-idea")!;
    press(pill); release(pill);
    expect(card(el, "notes/Idea.md").classList.contains("is-selected")).toBe(true);
    (el.querySelector(".czm-act-make-story") as HTMLElement).click();
    const name = el.querySelector<HTMLInputElement>(".czm-writer-promote-name")!;
    expect(name.value).toBe("Idea");
    expect(el.querySelector<HTMLInputElement>(".czm-writer-promote-folder")!.value).toBe("storytelling");
    name.value = "The Horse";
    (el.querySelector(".czm-act-promote") as HTMLElement).click();
    await tick(); await tick(); await tick();
    expect(calls.promoted).toEqual(["notes/Idea.md -> storytelling/The Horse"]);
    expect(calls.opened).toEqual(["storytelling/The Horse/The Horse.md"]);
    expect(el.querySelector(".czm-writer-story.is-selected .czm-writer-card-title")!.textContent).toBe("The Horse");
    expect(el.querySelectorAll(".czm-writer-pill-idea").length).toBe(0);
    press(card(el, "notes/Idea.md")); release(card(el, "notes/Idea.md"));
    expect(el.querySelector(".czm-act-story")!.textContent).toBe("Story: The Horse");
  });
  it("declares an unfiled folder from its pill, and starts a story from nothing from the panel", async () => {
    const { el, calls } = await open({}, baseNotes, undefined, { stories: [], ideas: [], unfiled: ["storytelling/Loose"], uses: new Map() });
    const pill = el.querySelector<SVGGElement>(".czm-writer-pill-unfiled")!;
    press(pill); release(pill);
    expect(el.querySelector(".czm-writer-side .czm-map-card-name")!.textContent).toBe("Loose");
    (el.querySelector(".czm-act-declare") as HTMLElement).click();
    await tick(); await tick();
    expect(calls.declared).toEqual(["storytelling/Loose"]);
    expect(el.querySelectorAll(".czm-writer-pill-unfiled").length).toBe(0);
    (el.querySelector(".czm-writer-new-story") as HTMLElement).click();
    const name = el.querySelector<HTMLInputElement>(".czm-writer-promote-name")!;
    name.value = "Fresh";
    name.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await tick(); await tick(); await tick();
    expect(calls.promoted).toEqual(["∅ -> storytelling/Fresh"]);
  });

  it("shows uses on cards and side cards, marks recurring ones, and lists what a story draws on", async () => {
    const uses = new Map([["notes/Courage.md", ["The Bear Hunt", "Horse"]], ["sources/Invictus.md", ["The Bear Hunt"]]]);
    const { el } = await open({}, baseNotes, undefined, { stories: [bearCard], ideas: [], unfiled: [], uses });
    expect(card(el, "notes/Courage.md").querySelector(".czm-writer-uses")!.textContent).toBe("2 stories");
    expect(card(el, "notes/Courage.md").querySelector(".czm-writer-uses")!.classList.contains("is-recurring")).toBe(true);
    expect(card(el, "sources/Invictus.md").querySelector(".czm-writer-uses")!.classList.contains("is-recurring")).toBe(false);
    expect(card(el, "notes/Wild.md").querySelector(".czm-writer-uses")).toBeNull();
    press(card(el, "notes/Courage.md")); release(card(el, "notes/Courage.md"));
    expect([...el.querySelectorAll(".czm-writer-use-row .czm-map-row-name")].map((r) => r.textContent)).toEqual(["The Bear Hunt", "Horse"]);
    (el.querySelector(".czm-writer-use-row") as HTMLElement).click();
    expect(el.querySelector(".czm-writer-story.is-selected")).not.toBeNull();
    expect([...el.querySelectorAll(".czm-writer-draws-row .czm-map-row-name")].map((r) => r.textContent)).toEqual(["Courage", "Invictus"]);
  });
  it("names a line between linked cards, draws it with its label, recolours and removes it, and dashes it once the link is gone", async () => {
    const { v, el, file } = await open();
    press(card(el, "notes/Courage.md")); release(card(el, "notes/Courage.md"));
    (el.querySelector(".czm-act-name-line") as HTMLElement).click();
    expect(el.querySelector(".czm-writer-side .czm-map-card-name")!.textContent).toBe("Courage — Invictus");
    (el.querySelector(".czm-act-suggest-edge") as HTMLElement).click();
    await flush(v); await tick(); await tick();
    expect(file().edges).toEqual([{ from: "notes/Courage.md", to: "sources/Invictus.md", label: "inspired by", colour: "" }]);
    expect(el.querySelector(".czm-writer-edge-named")).not.toBeNull();
    expect(el.querySelector(".czm-writer-edge-label")!.textContent).toBe("inspired by");
    expect(el.querySelectorAll(".czm-writer-edge").length).toBe(1);
    const colour = el.querySelector<HTMLInputElement>(".czm-writer-edge-colour")!;
    colour.value = "#123456";
    colour.dispatchEvent(new Event("input"));
    await flush(v); await tick(); await tick();
    expect(file().edges[0]!.colour).toBe("#123456");
    (el.querySelector(".czm-act-remove-edge") as HTMLElement).click();
    await flush(v); await tick(); await tick();
    expect(file().edges).toEqual([]);
    expect(el.querySelector(".czm-writer-edge-named")).toBeNull();

    const stale = { ...EMPTY_WRITER_FILE, edges: [{ from: "notes/Courage.md", to: "notes/Wild.md", label: "odd", colour: "" }] };
    const s = await open({}, baseNotes, stale);
    expect(s.el.querySelector(".czm-writer-edge-named.is-stale")).not.toBeNull();
    (s.el.querySelector(".czm-writer-edge-named") as unknown as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(s.el.querySelector(".czm-writer-side .czm-map-kind")!.textContent).toBe("The notes no longer link");
    expect(s.el.querySelector(".czm-writer-edge-input")).toBeNull();
  });
});
