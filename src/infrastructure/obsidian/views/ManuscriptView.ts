import { ItemView, Menu, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { EMPTY_MANUSCRIPT, type Manuscript, type ManuscriptBlock, type NoteItem } from "../../../domain/manuscript/Manuscript";
import { locateInBlock } from "../../../domain/manuscript/Locate";
import { colorOf, splitTag, type Annotation, type TagSpec } from "../../../domain/manuscript/Comments";
import { stripInlineMarkup } from "../../../domain/text/ProseParagraphs";
import type { Sentence } from "../../../domain/rhythm/Sentence";
import type { ManuscriptSettings } from "../../../domain/settings/Settings";
import { EMPTY_FACTS, NO_SECTION, easeLevel, type CastMember, type ConflictMark, type StoryFacts } from "../../../domain/manuscript/StoryFacts";
import type { EntityKind } from "../../../domain/story/StoryGraph";

export const MANUSCRIPT_VIEW_TYPE = "creative-writer-manuscript";

export interface ManuscriptSource {
  projects(): ProjectSpec[];
  activeProject(): ProjectSpec | null;
  build(project: ProjectSpec): Promise<Manuscript>;
  /** Renders Markdown into `el` the way reading view would; links resolve relative to `sourcePath`. */
  render(markdown: string, el: HTMLElement, sourcePath: string, view: ManuscriptView): Promise<void>;
  segment(text: string): Sentence[];
  /**
   * Puts the editor on a position. With `focus`, the note is opened (beside the page if need be) and the
   * editor takes focus; without, an editor already showing the note follows quietly and the page keeps focus.
   */
  reveal(path: string, line: number, ch: number, focus: boolean): void;
  openLink(link: string, sourcePath: string): void;
  settings(): ManuscriptSettings;
  updateSettings(next: ManuscriptSettings): void;
  /** Writes the manuscript as one note beside the project; resolves to its path. */
  exportNote(project: ProjectSpec): Promise<string>;
  /** Appends ` %% comment %%` to the end of a line of the note, through its open editor when there is one. */
  appendComment(path: string, line: number, comment: string): Promise<void>;
  /** Readability, today's words, and — with `story` — cast and contradictions for these notes. */
  facts(project: ProjectSpec, paths: readonly string[], story: boolean): Promise<StoryFacts>;
  storyColors(): Readonly<Record<EntityKind, string>>;
  /** A candidate becomes a typed note in the project's folder for that kind; resolves to its path. */
  promote(project: ProjectSpec, name: string, kind: EntityKind): Promise<string>;
  /** A candidate that is not a name: added to the project's `story-ignore`. */
  ignore(project: ProjectSpec, name: string): Promise<void>;
}

interface Rendered { readonly el: HTMLElement; readonly key: string }
interface BlockRef { readonly path: string; readonly block: ManuscriptBlock | null; readonly title: string }
interface Active { readonly path: string; readonly line: number }

/** Below this width the comments pane sits under the page instead of beside it. */
export const NARROW_WIDTH = 720;
const HOVER_DELAY_MS = 200;

/**
 * The whole story on one page, read-only: every prose note of the project
 * in manuscript order, the folder tree as its outline. Selecting a paragraph
 * — a click, or the arrow keys — makes the editor follow it without taking
 * focus; Enter or a double click goes into the editor at that sentence.
 * Each note keeps its own element and is re-rendered only when its text
 * changes, so typing in a chapter beside the page redraws that chapter and
 * nothing else.
 *
 * The writer's `%% comments %%` live in a pane beside the page: the active
 * paragraph's, colour-coded by tag, with one field where `TODO: the lamp`
 * and Enter appends a comment to that paragraph in the note; below, every
 * comment of the manuscript in reading order. Marked paragraphs carry dots
 * in the gutter and show their comments in a box on hover or focus.
 */
export class ManuscriptView extends ItemView {
  private project: ProjectSpec | null = null;
  private manuscript: Manuscript = EMPTY_MANUSCRIPT;
  private generation = 0;
  /** A refresh arrived while the leaf was hidden; render when it shows again. */
  private dirty = false;
  private head: HTMLElement | null = null;
  private ruler: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private facts: StoryFacts = EMPTY_FACTS;
  private page: HTMLElement | null = null;
  private side: HTMLElement | null = null;
  private pop: HTMLElement | null = null;
  private hoverTimer: number | null = null;
  private tagFilter = "";
  private active: Active | null = null;
  private draft = "";
  /** Put the caret back in the composer after the next render — a comment was just saved from it. */
  private focusComposer = false;
  private readonly rendered = new Map<string, Rendered>();
  private readonly refs = new WeakMap<HTMLElement, BlockRef>();

  constructor(leaf: WorkspaceLeaf, private readonly source: ManuscriptSource) {
    super(leaf);
  }

  getViewType(): string { return MANUSCRIPT_VIEW_TYPE; }
  getDisplayText(): string { return "Manuscript"; }
  getIcon(): string { return "book-open"; }

  async onOpen(): Promise<void> {
    if (!this.page) {
      this.contentEl.empty();
      const root = this.contentEl.createDiv({ cls: "czm-ms" });
      this.head = root.createDiv({ cls: "czm-ms-head" });
      this.ruler = root.createDiv({ cls: "czm-ms-ruler", attr: { role: "navigation", "aria-label": "Sections" } });
      this.ruler.addEventListener("keydown", (ev) => this.onRulerKey(ev));
      const main = root.createDiv({ cls: "czm-ms-main" });
      this.body = main.createDiv({ cls: "czm-ms-body" });
      this.page = this.body.createDiv({ cls: "czm-ms-page markdown-rendered", attr: { role: "region", "aria-label": "Manuscript" } });
      this.pop = this.body.createDiv({ cls: "czm-ms-pop" });
      this.pop.hidden = true;
      this.side = main.createDiv({ cls: "czm-ms-side", attr: { role: "complementary", "aria-label": "Comments" } });
      this.page.addEventListener("click", (ev) => this.onClick(ev));
      this.page.addEventListener("dblclick", (ev) => this.onDoubleClick(ev));
      this.page.addEventListener("keydown", (ev) => this.onPageKey(ev));
      this.page.addEventListener("mouseover", (ev) => this.onHover(ev));
      this.page.addEventListener("mouseleave", () => this.hidePop());
      this.page.addEventListener("focusin", (ev) => this.showPopFor((ev.target as HTMLElement).closest<HTMLElement>(".czm-ms-block")));
      this.page.addEventListener("focusout", () => this.hidePop());
      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(() => root.classList.toggle("is-narrow", root.clientWidth > 0 && root.clientWidth < NARROW_WIDTH));
        ro.observe(root);
        this.register(() => ro.disconnect());
      }
    }
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async show(project: ProjectSpec | null): Promise<void> {
    const generation = ++this.generation;
    if (this.project?.scope !== project?.scope) { this.rendered.clear(); this.active = null; }
    this.project = project;
    this.dirty = false;
    if (!project) { this.manuscript = EMPTY_MANUSCRIPT; this.facts = EMPTY_FACTS; this.renderHead(); this.renderRuler(); this.renderSide(); this.page?.empty(); return; }
    const manuscript = await this.source.build(project);
    if (generation !== this.generation) return;
    const s = this.source.settings();
    const paths = manuscript.items.filter((i): i is NoteItem => i.kind === "note").map((i) => i.path);
    const facts = s.showRuler || s.showStory ? await this.source.facts(project, paths, s.showStory) : EMPTY_FACTS;
    if (generation !== this.generation) return;
    this.manuscript = manuscript;
    this.facts = facts;
    this.renderHead();
    this.renderRuler();
    await this.renderPage(generation);
    this.renderSide();
  }

  /** Rebuild from the vault; deferred while the leaf is out of sight. */
  async refresh(): Promise<void> {
    if (!this.project) return;
    if (!this.isVisible()) { this.dirty = true; return; }
    await this.show(this.project);
  }

  onResize(): void {
    if (this.dirty && this.isVisible()) void this.refresh();
  }

  /** Focus the page at the paragraph holding a note's line — the way back from the editor. */
  focusAt(path: string | null, line: number): void {
    if (path) {
      for (const item of this.manuscript.items) {
        if (item.kind !== "note" || item.path !== path) continue;
        const block = item.blocks.find((b) => line >= b.from && line <= b.to) ?? item.blocks.find((b) => b.from > line) ?? item.blocks[item.blocks.length - 1];
        if (block) this.active = { path, line: block.from };
      }
    }
    if (!this.active) { const first = this.blockEls()[0]; const ref = first ? this.refs.get(first) : undefined; if (ref?.block) this.active = { path: ref.path, line: ref.block.from }; }
    this.markActive();
    this.renderSide();
    this.activeEl()?.focus();
  }

  private isVisible(): boolean {
    const el = this.containerEl as HTMLElement & { isShown?: () => boolean };
    return typeof el.isShown === "function" ? el.isShown() : true;
  }

  private annotations(): { item: NoteItem; a: Annotation }[] {
    const out: { item: NoteItem; a: Annotation }[] = [];
    for (const item of this.manuscript.items) if (item.kind === "note") for (const a of item.annotations) out.push({ item, a });
    return out;
  }

  private activeBlock(): { item: NoteItem; block: ManuscriptBlock } | null {
    if (!this.active) return null;
    for (const item of this.manuscript.items) {
      if (item.kind !== "note" || item.path !== this.active.path) continue;
      const block = item.blocks.find((b) => b.from === this.active!.line);
      return block ? { item, block } : null;
    }
    return null;
  }

  // --- header -------------------------------------------------------------------------------------------------

  private renderHead(): void {
    const head = this.head;
    if (!head) return;
    head.empty();
    const projects = this.source.projects();
    const select = head.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } });
    for (const p of projects) {
      const opt = select.createEl("option", { text: p.name });
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    select.addEventListener("change", () => void this.show(projects.find((p) => p.scope === select.value) ?? null));
    if (!this.project) { head.createSpan({ text: "No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one.", cls: "czm-map-hint" }); return; }
    const m = this.manuscript;
    const count = this.annotations().length;
    head.createSpan({ text: `${m.notes} section${m.notes === 1 ? "" : "s"} · ${m.words.toLocaleString()} words${count ? ` · ${count} comment${count === 1 ? "" : "s"}` : ""}`, cls: "czm-map-hint czm-ms-count" });
    const settings = this.source.settings();
    const tools = head.createDiv({ cls: "czm-ms-tools" });
    const toggle = (icon: string, label: string, on: boolean, apply: (v: boolean) => ManuscriptSettings) => {
      const btn = tools.createEl("button", { cls: `clickable-icon czm-ms-tool${on ? " is-active" : ""}`, attr: { "aria-label": label, "aria-pressed": String(on), title: label } });
      setIcon(btn, icon);
      btn.addEventListener("click", () => { this.source.updateSettings(apply(!on)); void this.refresh(); });
      return btn;
    };
    toggle("text", "Prose only: paragraphs, headings, quotes and scene breaks — no lists, tables, code or callouts", settings.proseOnly, (v) => ({ ...this.source.settings(), proseOnly: v }));
    toggle("message-square", "Comments pane: this paragraph's comments and a field to add one; every comment below", settings.showComments, (v) => ({ ...this.source.settings(), showComments: v }));
    toggle("ruler", "Ruler: one segment per section, wide by words, coloured by readability, marked when it changed today", settings.showRuler, (v) => ({ ...this.source.settings(), showRuler: v }));
    toggle("users", "Story: who is in each section and scene, and the model's contradictions in the gutter", settings.showStory, (v) => ({ ...this.source.settings(), showStory: v }));
    const project = this.project;
    const exportBtn = tools.createEl("button", { cls: "clickable-icon czm-ms-tool czm-ms-export", attr: { "aria-label": "Export as one note beside the project (comments left out)", title: "Export as one note beside the project (comments left out)" } });
    setIcon(exportBtn, "file-output");
    exportBtn.addEventListener("click", () => {
      exportBtn.disabled = true;
      void this.source.exportNote(project).then(() => {
        setIcon(exportBtn, "check");
        window.setTimeout(() => setIcon(exportBtn, "file-output"), 1200);
      }).finally(() => { exportBtn.disabled = false; });
    });
  }

  // --- ruler --------------------------------------------------------------------------------------------------

  /** The shape of the book: a segment per section, wide by words, coloured by how it reads, marked when it changed today. */
  private renderRuler(): void {
    const ruler = this.ruler;
    if (!ruler) return;
    ruler.empty();
    const notes = this.manuscript.items.filter((i): i is NoteItem => i.kind === "note");
    if (!this.project || !this.source.settings().showRuler || notes.length === 0) { ruler.hidden = true; return; }
    ruler.hidden = false;
    notes.forEach((n, i) => {
      const f = this.facts.sections.get(n.path) ?? NO_SECTION;
      const today = f.today.added || f.today.removed ? ` · today +${f.today.added.toLocaleString()} −${f.today.removed.toLocaleString()}` : "";
      const comments = n.annotations.length ? ` · ${n.annotations.length} comment${n.annotations.length === 1 ? "" : "s"}` : "";
      const label = `${n.title} · ${n.words.toLocaleString()} words${f.readability ? ` · ${f.readability.label}` : ""}${today}${comments}`;
      const seg = ruler.createEl("button", { cls: `czm-ms-ruler-seg${today ? " is-today" : ""}`, attr: { title: label, "aria-label": label, tabindex: i === 0 ? "0" : "-1" } });
      seg.style.flexGrow = String(Math.max(1, n.words));
      const level = easeLevel(f.readability?.label);
      if (level) seg.classList.add(`czm-ease-${level}`);
      if (n.annotations.length) seg.createSpan({ cls: "czm-ms-ruler-dot" });
      seg.addEventListener("click", () => this.selectNote(n.path));
    });
  }

  private onRulerKey(ev: KeyboardEvent): void {
    const segs = [...(this.ruler?.querySelectorAll<HTMLElement>(".czm-ms-ruler-seg") ?? [])];
    const at = segs.indexOf(ev.target as HTMLElement);
    if (at < 0) return;
    const go = (n: number) => { const next = segs[Math.max(0, Math.min(segs.length - 1, n))]; if (!next) return; for (const s of segs) s.tabIndex = -1; next.tabIndex = 0; next.focus(); };
    if (ev.key === "ArrowRight") { ev.preventDefault(); go(at + 1); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); go(at - 1); }
    else if (ev.key === "Home") { ev.preventDefault(); go(0); }
    else if (ev.key === "End") { ev.preventDefault(); go(segs.length - 1); }
  }

  /** Select a section's first paragraph, from the ruler. */
  private selectNote(path: string): void {
    const first = this.page?.querySelector<HTMLElement>(`.czm-ms-note[data-path="${cssEscape(path)}"] .czm-ms-block`);
    if (first) this.select(first, true);
  }

  // --- story on the page --------------------------------------------------------------------------------------

  /** Cast lines under the titles and contradiction marks in the gutter: laid over the cached note elements on every render. */
  private decorate(settings: ManuscriptSettings): void {
    const page = this.page;
    if (!page) return;
    for (const old of page.querySelectorAll(".czm-ms-cast, .czm-ms-mark.is-conflict")) old.remove();
    if (!settings.showStory) return;
    for (const noteEl of page.querySelectorAll<HTMLElement>(".czm-ms-note")) {
      const f = this.facts.sections.get(noteEl.dataset.path ?? "");
      if (!f || f.cast.length === 0) continue;
      const line = this.castLine(f.cast, noteEl.dataset.path ?? "", "");
      const title = noteEl.querySelector(".czm-ms-title");
      if (title) title.after(line); else noteEl.prepend(line);
    }
    for (const c of this.facts.conflicts) {
      const el = this.blockAt(c.path, c.line);
      if (!el) continue;
      const marks = el.querySelector<HTMLElement>(".czm-ms-marks") ?? el.createSpan({ cls: "czm-ms-marks" });
      marks.createSpan({ cls: "czm-ms-mark is-conflict", attr: { title: c.text, "aria-label": c.text } });
    }
  }

  private castLine(cast: readonly CastMember[], sourcePath: string, label: string): HTMLElement {
    const colors = this.source.storyColors();
    const line = createDiv({ cls: "czm-ms-cast" });
    if (label) line.createSpan({ text: label, cls: "czm-ms-cast-label" });
    cast.forEach((m, i) => {
      if (i) line.appendChild(document.createTextNode(" · "));
      const candidate = m.kind === "candidate";
      const title = candidate ? `${m.name} — a name the map found, ${m.mentions} mention${m.mentions === 1 ? "" : "s"}. Click to make it a note, or to say it is not a name.` : `${m.name} — ${m.kind}, ${m.mentions} mention${m.mentions === 1 ? "" : "s"}`;
      const name = line.createSpan({ text: m.name, cls: `czm-ms-cast-name${m.path ? " is-link" : ""}${candidate ? " is-candidate" : ""}`, attr: { title } });
      name.style.setProperty("--czm-kind", colors[m.kind]);
      if (m.path) name.addEventListener("click", (ev) => { ev.stopPropagation(); this.source.openLink(m.path!, sourcePath); });
      else if (candidate) name.addEventListener("click", (ev) => { ev.stopPropagation(); this.candidateMenu(ev, m.name); });
    });
    return line;
  }

  /** What a candidate is: the same exits the map offers. A choice makes the note and the page refreshes with the name linked. */
  private candidateMenu(ev: MouseEvent, name: string): void {
    const project = this.project;
    if (!project) return;
    const menu = new Menu();
    const kinds: [EntityKind, string, string][] = [["character", "a character", "user"], ["location", "a place", "map-pin"], ["item", "an item", "package"], ["faction", "a faction", "flag"], ["event", "an event", "calendar"]];
    for (const [kind, label, icon] of kinds) {
      menu.addItem((i) => i.setTitle(`${name} is ${label}`).setIcon(icon).onClick(() => void this.source.promote(project, name, kind).then(() => this.refresh())));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(`${name} is not a name`).setIcon("x").onClick(() => void this.source.ignore(project, name).then(() => this.refresh())));
    menu.showAtMouseEvent(ev);
  }

  /** The block of a note that holds a line. */
  private blockAt(path: string, line: number): HTMLElement | null {
    for (const el of this.page?.querySelectorAll<HTMLElement>(`.czm-ms-note[data-path="${cssEscape(path)}"] .czm-ms-block`) ?? []) {
      const ref = this.refs.get(el);
      if (ref?.block && line >= ref.block.from && line <= ref.block.to) return el;
    }
    return null;
  }

  private conflictsFor(path: string, block: ManuscriptBlock): ConflictMark[] {
    return this.facts.conflicts.filter((c) => c.path === path && c.line >= block.from && c.line <= block.to);
  }

  private renderConflicts(parent: HTMLElement, conflicts: readonly ConflictMark[]): void {
    for (const c of conflicts) {
      const row = parent.createDiv({ cls: "czm-ms-cm-row", attr: { role: "button", tabindex: "-1", title: "Open the other scene" } });
      row.createSpan({ text: "clash", cls: "czm-ms-cm-badge is-conflict" });
      row.createSpan({ text: c.text, cls: "czm-ms-cm-text" });
      row.addEventListener("click", () => this.goTo(c.otherPath, c.otherLine));
      row.addEventListener("dblclick", () => this.source.reveal(c.otherPath, c.otherLine, 0, true));
    }
  }

  // --- pane ---------------------------------------------------------------------------------------------------

  /** The pane: the active paragraph's comments and the composer, then every comment of the manuscript. */
  private renderSide(): void {
    const side = this.side;
    if (!side) return;
    side.empty();
    const settings = this.source.settings();
    if (!this.project || !settings.showComments) { side.hidden = true; return; }
    side.hidden = false;
    this.renderParagraphPane(side.createDiv({ cls: "czm-ms-side-para-wrap" }), settings);
    this.renderAllPane(side, settings);
  }

  /** The paragraph pane alone, when the selection moved but the list is being used. */
  private refreshParagraphPane(): void {
    const wrap = this.side?.querySelector<HTMLElement>(".czm-ms-side-para-wrap");
    if (!wrap || this.side?.hidden) return;
    wrap.empty();
    this.renderParagraphPane(wrap, this.source.settings());
  }

  /** Bring the page to a note's line: select the block holding it, scroll to it, let the editor follow. Focus stays where it is. */
  private goTo(path: string, line: number, match?: (b: ManuscriptBlock) => boolean): void {
    const blocks = [...(this.page?.querySelectorAll<HTMLElement>(`.czm-ms-note[data-path="${cssEscape(path)}"] .czm-ms-block`) ?? [])];
    const el = (match && blocks.find((b) => { const r = this.refs.get(b); return !!r?.block && match(r.block); })) ?? this.blockAt(path, line) ?? blocks.find((b) => { const r = this.refs.get(b); return !!r?.block && r.block.from > line; }) ?? blocks[blocks.length - 1];
    const ref = el ? this.refs.get(el) : undefined;
    if (!el || !ref?.block) return;
    this.active = { path: ref.path, line: ref.block.from };
    this.markActive();
    this.refreshParagraphPane();
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
    this.source.reveal(ref.path, ref.block.from, 0, false);
  }

  private renderParagraphPane(side: HTMLElement, settings: ManuscriptSettings): void {
    const pane = side.createDiv({ cls: "czm-ms-side-para" });
    const hit = this.activeBlock();
    const title = pane.createDiv({ cls: "czm-ms-side-title" });
    title.createSpan({ text: "This paragraph" });
    if (hit) title.createSpan({ text: hit.item.title, cls: "czm-ms-cm-where" });
    if (hit) {
      const { item, block } = hit;
      const excerpt = block.kind === "heading" ? block.headingText : block.markdown.split("\n").map((l) => stripInlineMarkup(l)).join(" ").replace(/\s+/g, " ").trim();
      pane.createEl("p", { text: excerpt.length > 90 ? `${excerpt.slice(0, 90)}…` : excerpt, cls: "czm-ms-side-excerpt" });
      const conflicts = this.conflictsFor(item.path, block);
      if (block.annotations.length === 0 && conflicts.length === 0) pane.createEl("p", { text: "No comments yet.", cls: "czm-ms-hint" });
      else {
        const rows = pane.createDiv({ cls: "czm-ms-cm-rows" });
        this.renderRows(rows, block.annotations.map((a) => ({ item, a })), settings.tags, false);
        this.renderConflicts(rows, conflicts);
      }
      if (settings.showStory) {
        const scenes = this.facts.sections.get(item.path)?.scenes ?? [];
        const scene = scenes.filter((s) => s.line <= block.from).pop();
        if (scene && scene.cast.length) pane.appendChild(this.castLine(scene.cast, item.path, "In this scene: "));
      }
    }

    // The composer: one field. `TODO: the lamp` and Enter. The tag is read from the prefix, shown as a chip while typing.
    const form = pane.createDiv({ cls: "czm-ms-compose" });
    const row = form.createDiv({ cls: "czm-ms-compose-row" });
    const chip = row.createSpan({ cls: "czm-ms-cm-badge czm-ms-compose-chip" });
    chip.hidden = true;
    const text = row.createEl("textarea", { cls: "czm-ms-compose-text", attr: { rows: "1", placeholder: hit ? "TODO: a note on this paragraph, then Enter" : "Select a paragraph first", "aria-label": "New comment" } });
    text.disabled = !hit;
    text.value = this.draft;
    const reflectTag = () => {
      const { tag } = splitTag(text.value);
      chip.hidden = !tag;
      chip.textContent = tag ?? "";
      const color = colorOf(tag, settings.tags);
      if (color) chip.style.setProperty("--czm-tag", color); else chip.style.removeProperty("--czm-tag");
    };
    const grow = () => { text.style.height = "auto"; text.style.height = `${text.scrollHeight}px`; };
    text.addEventListener("input", () => { this.draft = text.value; reflectTag(); grow(); });
    reflectTag();
    const submit = () => {
      if (!hit) return;
      const comment = text.value.trim();
      if (!comment) return;
      text.disabled = true;
      this.focusComposer = true;
      void this.source.appendComment(hit.item.path, hit.block.to, comment).then(() => { this.draft = ""; return this.refresh(); }).finally(() => { text.disabled = false; });
    };
    text.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submit(); return; }
      if (ev.key === "Escape") { ev.preventDefault(); if (text.value) { text.value = ""; this.draft = ""; reflectTag(); grow(); } else this.activeEl()?.focus(); }
    });
    const where = form.createDiv({ cls: "czm-ms-compose-where" });
    where.setText(hit ? `Enter appends it to the end of this paragraph in ${hit.item.title}. Shift+Enter for a new line.` : "Click a paragraph, or press an arrow key on the page, to comment on it.");
    // The tags as a legend; a click drops the prefix in, for anyone who prefers the mouse.
    const legend = form.createDiv({ cls: "czm-ms-legend" });
    for (const t of settings.tags) {
      const c = legend.createEl("button", { text: t.name, cls: "czm-ms-cm-badge czm-ms-legend-chip", attr: { type: "button", tabindex: "-1", title: `Start the comment with ${t.name}:` } });
      c.style.setProperty("--czm-tag", t.color);
      c.addEventListener("click", () => { if (text.disabled) return; text.value = `${t.name}: ${text.value.replace(/^\s*[A-Z][A-Z0-9_-]{1,15}:\s*/, "")}`; this.draft = text.value; reflectTag(); text.focus(); text.setSelectionRange(text.value.length, text.value.length); });
    }
    if (this.focusComposer && hit) { this.focusComposer = false; text.focus(); }
  }

  private renderAllPane(side: HTMLElement, settings: ManuscriptSettings): void {
    const pane = side.createDiv({ cls: "czm-ms-side-all" });
    const all = this.annotations();
    const title = pane.createDiv({ cls: "czm-ms-side-title" });
    title.createSpan({ text: all.length ? `All comments (${all.length})` : "All comments" });
    if (all.length === 0) { pane.createEl("p", { text: "None in the manuscript yet.", cls: "czm-ms-hint" }); return; }
    const tags = [...new Set(all.map(({ a }) => tagKey(a)))].sort();
    const filter = title.createEl("select", { cls: "dropdown", attr: { "aria-label": "Show comments with tag" } });
    const options: [string, string][] = [["", "All"], ...tags.map((t): [string, string] => [t, `${t === "==" ? "Highlights" : t === "-" ? "Untagged" : t} (${all.filter(({ a }) => tagKey(a) === t).length})`])];
    for (const [value, label] of options) { const o = filter.createEl("option", { text: label }); o.value = value; if (value === this.tagFilter) o.selected = true; }
    filter.addEventListener("change", () => { this.tagFilter = filter.value; this.renderSide(); });
    const shown = all.filter(({ a }) => !this.tagFilter || tagKey(a) === this.tagFilter);
    this.renderRows(pane.createDiv({ cls: "czm-ms-cm-rows", attr: { role: "list" } }), shown, settings.tags, true);
  }

  /** Comment rows: a tag badge in its colour, the text, and where it is. Arrows move, Enter opens the editor, Escape returns to the page. */
  private renderRows(parent: HTMLElement, rows: readonly { item: Pick<NoteItem, "title" | "path">; a: Annotation }[], tags: readonly TagSpec[], where: boolean): void {
    rows.forEach(({ item, a }, i) => {
      const row = parent.createDiv({ cls: "czm-ms-cm-row", attr: { role: "button", tabindex: i === 0 ? "0" : "-1" } });
      const badge = row.createSpan({ text: a.kind === "highlight" ? "mark" : a.tag ?? "note", cls: `czm-ms-cm-badge${a.kind === "highlight" ? " is-highlight" : ""}` });
      const color = colorOf(a.tag, tags);
      if (color) badge.style.setProperty("--czm-tag", color);
      row.createSpan({ text: a.text.length > 160 ? `${a.text.slice(0, 160)}…` : a.text, cls: "czm-ms-cm-text" });
      if (where) row.createSpan({ text: item.title, cls: "czm-ms-cm-where" });
      // Click: the page goes to the paragraph and the editor follows. Double click or Shift+Enter: into the editor at the comment.
      row.addEventListener("click", () => this.goTo(item.path, a.line, (b) => b.annotations.includes(a)));
      row.addEventListener("dblclick", () => this.source.reveal(item.path, a.line, a.ch, true));
    });
    parent.addEventListener("keydown", (ev) => {
      const items = [...parent.querySelectorAll<HTMLElement>(".czm-ms-cm-row")];
      const at = items.indexOf(ev.target as HTMLElement);
      if (at < 0) return;
      const go = (n: number) => { const next = items[Math.max(0, Math.min(items.length - 1, n))]; if (!next) return; for (const r of items) r.tabIndex = -1; next.tabIndex = 0; next.focus(); };
      if (ev.key === "ArrowDown") { ev.preventDefault(); go(at + 1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); go(at - 1); }
      else if (ev.key === "Home") { ev.preventDefault(); go(0); }
      else if (ev.key === "End") { ev.preventDefault(); go(items.length - 1); }
      else if ((ev.key === "Enter" || ev.key === " ") && ev.shiftKey) { ev.preventDefault(); items[at]!.dispatchEvent(new MouseEvent("dblclick")); }
      else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); items[at]!.click(); }
      else if (ev.key === "Escape") { ev.preventDefault(); this.activeEl()?.focus(); }
    });
  }

  // --- page ---------------------------------------------------------------------------------------------------

  private async renderPage(generation: number): Promise<void> {
    const page = this.page;
    if (!page) return;
    if (this.manuscript.items.length === 0) {
      page.empty();
      page.createEl("p", { text: "Nothing to read yet. Notes with prose in the project folder appear here; characters, places and other typed notes stay out, and so does any note with manuscript: false.", cls: "czm-ms-hint" });
      return;
    }
    const settings = this.source.settings();
    const variant = settings.tags.map((t) => `${t.name}${t.color}`).join(",");
    const order: HTMLElement[] = [];
    const keep = new Set<string>();
    for (const item of this.manuscript.items) {
      if (item.kind === "folder") {
        order.push(createEl(`h${item.level}` as "h1", { cls: `czm-ms-folder czm-ms-folder-${item.level}`, text: item.title }));
        continue;
      }
      const key = `${variant}|${noteKey(item)}`;
      const cached = this.rendered.get(item.path);
      let el = cached?.key === key ? cached.el : null;
      if (!el) {
        el = await this.renderNote(item, settings);
        if (generation !== this.generation) return;
        this.rendered.set(item.path, { el, key });
      }
      keep.add(item.path);
      order.push(el);
    }
    for (const path of [...this.rendered.keys()]) if (!keep.has(path)) this.rendered.delete(path);
    page.replaceChildren(...order);
    this.decorate(settings);
    this.markActive();
  }

  private async renderNote(item: NoteItem, settings: ManuscriptSettings): Promise<HTMLElement> {
    const el = createDiv({ cls: "czm-ms-note", attr: { "data-path": item.path } });
    if (item.showTitle) {
      const h = el.createEl(`h${item.level}` as "h1", { cls: "czm-ms-title", text: item.title });
      h.createSpan({ text: `${item.words.toLocaleString()} words`, cls: "czm-ms-meta" });
      this.refs.set(h, { path: item.path, block: null, title: item.title });
    }
    for (const block of item.blocks) {
      const b = el.createDiv({ cls: `czm-ms-block czm-ms-${block.kind}`, attr: { "data-line": String(block.from), tabindex: "-1" } });
      const markdown = block.heading ? `${"#".repeat(block.level)} ${block.headingText}` : block.markdown;
      await this.source.render(markdown, b, item.path, this);
      if (block.annotations.length) {
        // One dot per comment in the gutter, in its tag's colour; the tooltip says what it is, the box says the rest.
        const marks = b.createSpan({ cls: "czm-ms-marks" });
        for (const a of block.annotations) {
          const label = a.kind === "highlight" ? `Highlight: ${a.text}` : `${a.tag ? `${a.tag}: ` : ""}${a.text}`;
          const dot = marks.createSpan({ cls: `czm-ms-mark${a.kind === "highlight" ? " is-highlight" : ""}`, attr: { title: label, "aria-label": label } });
          const color = colorOf(a.tag, settings.tags);
          if (color) dot.style.setProperty("--czm-tag", color);
        }
      }
      this.refs.set(b, { path: item.path, block, title: item.title });
    }
    return el;
  }

  private blockEls(): HTMLElement[] {
    return [...(this.page?.querySelectorAll<HTMLElement>(".czm-ms-block") ?? [])];
  }

  private activeEl(): HTMLElement | null {
    if (!this.active) return null;
    return this.page?.querySelector<HTMLElement>(`.czm-ms-note[data-path="${cssEscape(this.active.path)}"] .czm-ms-block[data-line="${this.active.line}"]`) ?? null;
  }

  /** One tab stop for the page: the active block, or the first. */
  private markActive(): void {
    const blocks = this.blockEls();
    const current = this.activeEl() ?? blocks[0] ?? null;
    for (const b of blocks) { b.classList.toggle("is-active", b === current && !!this.active); b.tabIndex = b === current ? 0 : -1; }
  }

  /** Select a block: the pane follows, and so does an editor already showing the note. */
  private select(el: HTMLElement, focus: boolean): void {
    const ref = this.refs.get(el);
    if (!ref?.block) return;
    this.active = { path: ref.path, line: ref.block.from };
    this.markActive();
    this.renderSide();
    if (focus) { el.focus({ preventScroll: true }); if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" }); }
    this.source.reveal(ref.path, ref.block.from, 0, false);
  }

  private onClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      if (!anchor.classList.contains("internal-link")) return;
      ev.preventDefault();
      const link = anchor.getAttribute("data-href") ?? anchor.getAttribute("href") ?? "";
      this.source.openLink(link, target.closest<HTMLElement>("[data-path]")?.dataset.path ?? "");
      return;
    }
    const el = target.closest<HTMLElement>(".czm-ms-block, .czm-ms-title");
    const ref = el ? this.refs.get(el) : undefined;
    if (!el || !ref) return;
    if (!ref.block) { this.source.reveal(ref.path, 0, 0, true); return; }
    this.select(el, true);
  }

  /** Into the editor, at the sentence under the pointer. */
  private onDoubleClick(ev: MouseEvent): void {
    const el = (ev.target as HTMLElement).closest<HTMLElement>(".czm-ms-block");
    const ref = el ? this.refs.get(el) : undefined;
    if (!el || !ref?.block) return;
    ev.preventDefault();
    window.getSelection()?.removeAllRanges();
    const rendered = el.textContent ?? "";
    const at = locateInBlock(ref.block.markdown, rendered, this.source.segment(rendered), caretOffset(el, ev.clientX, ev.clientY));
    this.source.reveal(ref.path, ref.block.from + at.line, at.ch, true);
  }

  private onPageKey(ev: KeyboardEvent): void {
    const blocks = this.blockEls();
    if (blocks.length === 0) return;
    const current = this.activeEl() ?? blocks[0]!;
    const at = blocks.indexOf(current);
    const move = (n: number) => { const next = blocks[Math.max(0, Math.min(blocks.length - 1, n))]; if (next) this.select(next, true); };
    const chapterStart = (dir: 1 | -1) => {
      const notes = [...(this.page?.querySelectorAll<HTMLElement>(".czm-ms-note") ?? [])];
      const own = current.closest<HTMLElement>(".czm-ms-note");
      const i = notes.indexOf(own!);
      const target = notes[i + dir];
      const first = target?.querySelector<HTMLElement>(".czm-ms-block");
      if (first) this.select(first, true);
    };
    switch (ev.key) {
      case "ArrowDown": ev.preventDefault(); if (ev.altKey) chapterStart(1); else move(at + 1); break;
      case "ArrowUp": ev.preventDefault(); if (ev.altKey) chapterStart(-1); else move(at - 1); break;
      case "Home": ev.preventDefault(); move(0); break;
      case "End": ev.preventDefault(); move(blocks.length - 1); break;
      case "Enter": {
        ev.preventDefault();
        const ref = this.refs.get(current);
        if (ref?.block) { if (!this.active) this.select(current, false); this.source.reveal(ref.path, ref.block.from, 0, true); }
        break;
      }
      case "c": {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        ev.preventDefault();
        if (!this.active) this.select(current, false);
        if (!this.source.settings().showComments) { this.source.updateSettings({ ...this.source.settings(), showComments: true }); this.renderSide(); }
        this.side?.querySelector<HTMLTextAreaElement>(".czm-ms-compose-text")?.focus();
        break;
      }
    }
  }

  // --- hover box ----------------------------------------------------------------------------------------------

  private onHover(ev: MouseEvent): void {
    const el = (ev.target as HTMLElement).closest<HTMLElement>(".czm-ms-block");
    if (this.hoverTimer !== null) { window.clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    const ref = el ? this.refs.get(el) : undefined;
    if (!el || !ref?.block || (ref.block.annotations.length === 0 && this.conflictsFor(ref.path, ref.block).length === 0)) { this.hidePop(); return; }
    if (this.pop?.dataset.for === keyOf(ref) && !this.pop.hidden) return;
    // Intent, not passage: crossing three paragraphs on the way somewhere should not flash three boxes.
    this.hoverTimer = window.setTimeout(() => { this.hoverTimer = null; this.showPopFor(el); }, HOVER_DELAY_MS);
  }

  private showPopFor(el: HTMLElement | null): void {
    const ref = el ? this.refs.get(el) : undefined;
    const pop = this.pop, body = this.body, page = this.page;
    const conflicts = el && ref?.block ? this.conflictsFor(ref.path, ref.block) : [];
    if (!el || !ref?.block || (ref.block.annotations.length === 0 && conflicts.length === 0) || !pop || !body || !page) { this.hidePop(); return; }
    pop.empty();
    pop.dataset.for = keyOf(ref);
    const item = { title: ref.title, path: ref.path };
    this.renderRows(pop, ref.block.annotations.map((a) => ({ item, a })), this.source.settings().tags, false);
    this.renderConflicts(pop, conflicts);
    for (const r of pop.querySelectorAll<HTMLElement>(".czm-ms-cm-row")) r.tabIndex = -1;
    pop.hidden = false;
    // Beside the page in the margin when there is room, else under the paragraph; never past the bottom.
    const r = el.getBoundingClientRect(), b = body.getBoundingClientRect(), p = page.getBoundingClientRect();
    const room = b.right - p.right;
    const top = r.top - b.top + body.scrollTop;
    if (room >= 240) { pop.style.left = `${p.right - b.left + 8}px`; pop.style.top = `${top}px`; pop.style.maxWidth = `${Math.min(360, room - 16)}px`; }
    else { pop.style.left = `${Math.max(0, r.left - b.left)}px`; pop.style.top = `${r.bottom - b.top + body.scrollTop}px`; pop.style.maxWidth = "360px"; }
    const overflow = parseFloat(pop.style.top) + pop.offsetHeight - (body.scrollTop + body.clientHeight);
    if (overflow > 0 && body.clientHeight > 0) pop.style.top = `${Math.max(0, parseFloat(pop.style.top) - overflow - 8)}px`;
  }

  private hidePop(): void {
    if (this.hoverTimer !== null) { window.clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    if (this.pop) { this.pop.hidden = true; delete this.pop.dataset.for; }
  }
}

function keyOf(ref: BlockRef): string {
  return `${ref.path}#${ref.block?.from ?? -1}`;
}

function tagKey(a: Annotation): string {
  return a.kind === "highlight" ? "==" : a.tag ?? "-";
}

/** Everything that decides how a note renders; when it is unchanged the element is reused as is. */
function noteKey(item: NoteItem): string {
  return `${item.level}|${item.showTitle ? item.title : ""}|${item.words}|${item.blocks.map((b) => `${b.level}:${b.kind}:${b.from}:${b.markdown}:${b.annotations.map((a) => `${a.kind}${a.tag}${a.line}${a.text}`).join(",")}`).join(" ")}`;
}

function cssEscape(s: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&");
}

/** Character offset of a point inside an element's text, as `textContent` counts it; 0 when the platform cannot say. */
function caretOffset(el: HTMLElement, x: number, y: number): number {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null, offset = 0;
  if (typeof doc.caretPositionFromPoint === "function") {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  } else if (typeof doc.caretRangeFromPoint === "function") {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  if (!node || !el.contains(node) || node.nodeType !== Node.TEXT_NODE) return 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let sum = 0;
  for (let cur = walker.nextNode(); cur; cur = walker.nextNode()) {
    if (cur === node) return sum + offset;
    sum += cur.textContent?.length ?? 0;
  }
  return 0;
}
