import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { EMPTY_MANUSCRIPT, type Manuscript, type ManuscriptBlock, type NoteItem } from "../../../domain/manuscript/Manuscript";
import { locateInBlock } from "../../../domain/manuscript/Locate";
import { colorOf, type Annotation, type TagSpec } from "../../../domain/manuscript/Comments";
import type { Sentence } from "../../../domain/rhythm/Sentence";
import type { ManuscriptSettings } from "../../../domain/settings/Settings";

export const MANUSCRIPT_VIEW_TYPE = "creative-writer-manuscript";

export interface ManuscriptSource {
  projects(): ProjectSpec[];
  activeProject(): ProjectSpec | null;
  build(project: ProjectSpec): Promise<Manuscript>;
  /** Renders Markdown into `el` the way reading view would; links resolve relative to `sourcePath`. */
  render(markdown: string, el: HTMLElement, sourcePath: string, view: ManuscriptView): Promise<void>;
  segment(text: string): Sentence[];
  /** Opens the note in an editor with the cursor at the position. */
  reveal(path: string, line: number, ch: number): void;
  openLink(link: string, sourcePath: string): void;
  settings(): ManuscriptSettings;
  updateSettings(next: ManuscriptSettings): void;
  /** Writes the manuscript as one note beside the project; resolves to its path. */
  exportNote(project: ProjectSpec): Promise<string>;
  /** Appends ` %% comment %%` to the end of a line of the note, through its open editor when there is one. */
  appendComment(path: string, line: number, comment: string): Promise<void>;
}

interface Rendered { readonly el: HTMLElement; readonly key: string }
interface BlockRef { readonly path: string; readonly block: ManuscriptBlock | null; readonly title: string }
interface Active { readonly path: string; readonly line: number }

/**
 * The whole story on one page, read-only: every prose note of the project
 * in manuscript order, the folder tree as its outline. A click on any
 * passage opens the note in the editor at that sentence. Each note keeps
 * its own element and is re-rendered only when its text changes, so typing
 * in a chapter beside the page redraws that chapter and nothing else.
 *
 * The writer's `%% comments %%` live in a pane beside the page: the active
 * paragraph's comments, colour-coded by tag, with a box to write a new one
 * that lands at the end of that paragraph in the note; below, every comment
 * of the manuscript in reading order. Hovering a marked paragraph shows its
 * comments in a box, so the pane can stay closed.
 */
export class ManuscriptView extends ItemView {
  private project: ProjectSpec | null = null;
  private manuscript: Manuscript = EMPTY_MANUSCRIPT;
  private generation = 0;
  /** A refresh arrived while the leaf was hidden; render when it shows again. */
  private dirty = false;
  private head: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private page: HTMLElement | null = null;
  private side: HTMLElement | null = null;
  private pop: HTMLElement | null = null;
  private tagFilter = "";
  private active: Active | null = null;
  private draft = "";
  private draftTag = "";
  private readonly rendered = new Map<string, Rendered>();
  private readonly refs = new WeakMap<HTMLElement, BlockRef>();

  constructor(leaf: WorkspaceLeaf, private readonly source: ManuscriptSource) {
    super(leaf);
  }

  getViewType(): string { return MANUSCRIPT_VIEW_TYPE; }
  getDisplayText(): string { return this.project ? `Manuscript · ${this.project.name}` : "Manuscript"; }
  getIcon(): string { return "book-open"; }

  async onOpen(): Promise<void> {
    if (!this.page) {
      this.contentEl.empty();
      const root = this.contentEl.createDiv({ cls: "czm-ms" });
      this.head = root.createDiv({ cls: "czm-ms-head" });
      const main = root.createDiv({ cls: "czm-ms-main" });
      this.body = main.createDiv({ cls: "czm-ms-body" });
      this.page = this.body.createDiv({ cls: "czm-ms-page markdown-rendered" });
      this.pop = this.body.createDiv({ cls: "czm-ms-pop" });
      this.pop.hidden = true;
      this.side = main.createDiv({ cls: "czm-ms-side" });
      this.page.addEventListener("click", (ev) => this.onClick(ev));
      this.page.addEventListener("mouseover", (ev) => this.onHover(ev));
      this.page.addEventListener("mouseleave", () => this.hidePop());
    }
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async show(project: ProjectSpec | null): Promise<void> {
    const generation = ++this.generation;
    if (this.project?.scope !== project?.scope) { this.rendered.clear(); this.active = null; }
    this.project = project;
    this.dirty = false;
    if (!project) { this.manuscript = EMPTY_MANUSCRIPT; this.renderHead(); this.renderSide(); this.page?.empty(); return; }
    const manuscript = await this.source.build(project);
    if (generation !== this.generation) return;
    this.manuscript = manuscript;
    this.renderHead();
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
    head.createSpan({ text: `${m.notes} note${m.notes === 1 ? "" : "s"} · ${m.words.toLocaleString()} words`, cls: "czm-map-hint" });
    const settings = this.source.settings();
    const toggles = head.createDiv({ cls: "czm-ms-toggles" });
    const toggle = (label: string, title: string, on: boolean, apply: (v: boolean) => ManuscriptSettings) => {
      const wrap = toggles.createEl("label", { attr: { title } });
      const box = wrap.createEl("input", { attr: { type: "checkbox" } });
      box.checked = on;
      wrap.appendChild(document.createTextNode(label));
      box.addEventListener("change", () => { this.source.updateSettings(apply(box.checked)); void this.refresh(); });
    };
    toggle("Prose only", "Show only paragraphs, headings, quotes and scene breaks — no lists, tables, code or callouts.", settings.proseOnly, (v) => ({ ...this.source.settings(), proseOnly: v }));
    const count = this.annotations().length;
    toggle(count ? `Comments (${count})` : "Comments", "A pane beside the page: the active paragraph's %% comments %%, a box to add one, and every comment in reading order. Hover a marked paragraph for its comments either way.", settings.showComments, (v) => ({ ...this.source.settings(), showComments: v }));
    const project = this.project;
    const exportBtn = toggles.createEl("button", { text: "Export", cls: "czm-ms-export", attr: { title: "Write the manuscript as one note beside the project — comments left out — for Pandoc, a reader or a printer. Overwritten on every export." } });
    exportBtn.addEventListener("click", () => {
      exportBtn.disabled = true;
      void this.source.exportNote(project).then((path) => { exportBtn.textContent = `Exported: ${path.slice(path.lastIndexOf("/") + 1)}`; }).finally(() => { exportBtn.disabled = false; });
    });
  }

  /** The pane: the active paragraph's comments and a composer, then every comment of the manuscript. */
  private renderSide(): void {
    const side = this.side;
    if (!side) return;
    side.empty();
    const settings = this.source.settings();
    if (!this.project || !settings.showComments) { side.hidden = true; return; }
    side.hidden = false;
    this.renderParagraphPane(side, settings);
    this.renderAllPane(side, settings);
  }

  private renderParagraphPane(side: HTMLElement, settings: ManuscriptSettings): void {
    const pane = side.createDiv({ cls: "czm-ms-side-para" });
    const hit = this.activeBlock();
    if (!hit) {
      pane.createDiv({ text: "This paragraph", cls: "czm-ms-side-title" });
      pane.createEl("p", { text: "Click a paragraph on the page to see its comments here and add one of your own.", cls: "czm-ms-hint" });
      return;
    }
    const { item, block } = hit;
    const title = pane.createDiv({ cls: "czm-ms-side-title" });
    title.createSpan({ text: "This paragraph" });
    title.createSpan({ text: item.title, cls: "czm-ms-cm-where" });
    const excerpt = block.kind === "heading" ? block.headingText : block.markdown.replace(/%%[^\n]*?%%/g, "").replace(/\s+/g, " ").trim();
    pane.createEl("p", { text: excerpt.length > 90 ? `${excerpt.slice(0, 90)}…` : excerpt, cls: "czm-ms-side-excerpt" });
    if (block.annotations.length === 0) pane.createEl("p", { text: "No comments yet.", cls: "czm-ms-hint" });
    else renderRows(pane.createDiv({ cls: "czm-ms-cm-rows" }), block.annotations.map((a) => ({ item, a })), settings.tags, false, (p, a) => this.source.reveal(p, a.line, a.ch));

    const form = pane.createDiv({ cls: "czm-ms-compose" });
    const tag = form.createEl("select", { cls: "dropdown", attr: { "aria-label": "Tag" } });
    const choices: [string, string][] = [["", "No tag"], ...settings.tags.map((t): [string, string] => [t.name, t.name])];
    for (const [value, label] of choices) {
      const o = tag.createEl("option", { text: label }); o.value = value; if (value === this.draftTag) o.selected = true;
    }
    tag.addEventListener("change", () => { this.draftTag = tag.value; });
    const text = form.createEl("textarea", { cls: "czm-ms-compose-text", attr: { rows: "3", placeholder: "A note to self on this paragraph…", "aria-label": "Comment" } });
    text.value = this.draft;
    text.addEventListener("input", () => { this.draft = text.value; });
    const add = form.createEl("button", { text: "Add comment", cls: "mod-cta" });
    const submit = () => {
      const body = text.value.trim();
      if (!body) return;
      const comment = this.draftTag ? `${this.draftTag}: ${body}` : body;
      add.disabled = true;
      void this.source.appendComment(item.path, block.to, comment).then(() => { this.draft = ""; return this.refresh(); }).finally(() => { add.disabled = false; });
    };
    add.addEventListener("click", submit);
    text.addEventListener("keydown", (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") submit(); });
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
    renderRows(pane.createDiv({ cls: "czm-ms-cm-rows" }), shown, settings.tags, true, (p, a) => this.source.reveal(p, a.line, a.ch));
  }

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
        order.push(createEl(`h${item.level}` as "h1", { cls: "czm-ms-folder", text: item.title }));
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
    this.markActive();
  }

  private async renderNote(item: NoteItem, settings: ManuscriptSettings): Promise<HTMLElement> {
    const el = createDiv({ cls: "czm-ms-note", attr: { "data-path": item.path } });
    if (item.showTitle) {
      const h = el.createEl(`h${item.level}` as "h1", { cls: "czm-ms-title", text: item.title });
      h.createSpan({ text: `${item.words.toLocaleString()} w`, cls: "czm-ms-meta" });
      this.refs.set(h, { path: item.path, block: null, title: item.title });
    }
    for (const block of item.blocks) {
      const b = el.createDiv({ cls: `czm-ms-block czm-ms-${block.kind}`, attr: { "data-line": String(block.from) } });
      const markdown = block.heading ? `${"#".repeat(block.level)} ${block.headingText}` : block.markdown;
      await this.source.render(markdown, b, item.path, this);
      if (block.annotations.length) {
        // One dot per comment, in its tag's colour, at the paragraph's edge: the hover and the pane say the rest.
        const marks = b.createSpan({ cls: "czm-ms-marks", attr: { "aria-label": `${block.annotations.length} comment${block.annotations.length === 1 ? "" : "s"}` } });
        for (const a of block.annotations) {
          const dot = marks.createSpan({ cls: `czm-ms-mark${a.kind === "highlight" ? " is-highlight" : ""}` });
          const color = colorOf(a.tag, settings.tags);
          if (color) dot.style.setProperty("--czm-tag", color);
        }
      }
      this.refs.set(b, { path: item.path, block, title: item.title });
    }
    return el;
  }

  private markActive(): void {
    for (const el of this.page?.querySelectorAll(".czm-ms-block.is-active") ?? []) el.classList.remove("is-active");
    if (!this.active) return;
    const el = this.page?.querySelector(`.czm-ms-note[data-path="${cssEscape(this.active.path)}"] .czm-ms-block[data-line="${this.active.line}"]`);
    el?.classList.add("is-active");
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
    if (!ref.block) { this.source.reveal(ref.path, 0, 0); return; }
    this.active = { path: ref.path, line: ref.block.from };
    this.markActive();
    this.renderSide();
    const rendered = el.textContent ?? "";
    const at = locateInBlock(ref.block.markdown, rendered, this.source.segment(rendered), caretOffset(el, ev.clientX, ev.clientY));
    this.source.reveal(ref.path, ref.block.from + at.line, at.ch);
  }

  /** Hovering a paragraph with comments shows them in a box under it; anything else hides the box. */
  private onHover(ev: MouseEvent): void {
    const el = (ev.target as HTMLElement).closest<HTMLElement>(".czm-ms-block");
    const ref = el ? this.refs.get(el) : undefined;
    if (!el || !ref?.block || ref.block.annotations.length === 0) { this.hidePop(); return; }
    const pop = this.pop, body = this.body;
    if (!pop || !body) return;
    if (pop.dataset.for === `${ref.path}#${ref.block.from}` && !pop.hidden) return;
    pop.empty();
    pop.dataset.for = `${ref.path}#${ref.block.from}`;
    const item = { title: ref.title, path: ref.path } as NoteItem;
    renderRows(pop, ref.block.annotations.map((a) => ({ item, a })), this.source.settings().tags, false, (p, a) => this.source.reveal(p, a.line, a.ch));
    pop.hidden = false;
    const r = el.getBoundingClientRect(), b = body.getBoundingClientRect();
    pop.style.top = `${r.bottom - b.top + body.scrollTop}px`;
    pop.style.left = `${Math.max(0, r.left - b.left + body.scrollLeft)}px`;
  }

  private hidePop(): void {
    if (this.pop) { this.pop.hidden = true; delete this.pop.dataset.for; }
  }
}

function tagKey(a: Annotation): string {
  return a.kind === "highlight" ? "==" : a.tag ?? "-";
}

/** Comment rows: a tag badge in its colour, the text, and where it is; a click opens the editor on it. */
function renderRows(parent: HTMLElement, rows: readonly { item: Pick<NoteItem, "title" | "path">; a: Annotation }[], tags: readonly TagSpec[], where: boolean, open: (path: string, a: Annotation) => void): void {
  for (const { item, a } of rows) {
    const row = parent.createDiv({ cls: "czm-ms-cm-row", attr: { role: "button", tabindex: "0" } });
    const badge = row.createSpan({ text: a.kind === "highlight" ? "==" : a.tag ?? "%%", cls: "czm-ms-cm-badge" });
    const color = colorOf(a.tag, tags);
    if (color) badge.style.setProperty("--czm-tag", color);
    row.createSpan({ text: a.text.length > 160 ? `${a.text.slice(0, 160)}…` : a.text, cls: "czm-ms-cm-text" });
    if (where) row.createSpan({ text: item.title, cls: "czm-ms-cm-where" });
    const go = () => open(item.path, a);
    row.addEventListener("click", go);
    row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") go(); });
  }
}

/** Everything that decides how a note renders; when it is unchanged the element is reused as is. */
function noteKey(item: NoteItem): string {
  return `${item.level}|${item.showTitle ? item.title : ""}|${item.words}|${item.blocks.map((b) => `${b.level}:${b.kind}:${b.from}:${b.markdown}:${b.annotations.map((a) => `${a.kind}${a.tag}${a.line}`).join(",")}`).join(" ")}`;
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
