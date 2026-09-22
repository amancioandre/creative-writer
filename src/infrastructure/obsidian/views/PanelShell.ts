import { Menu, setIcon } from "obsidian";
import { commandName, type CommandId } from "../commands";

/** The panels a writer moves between, in the order they are offered everywhere. */
export type PanelId = "desk" | "board" | "map" | "timeline" | "threads" | "manuscript";

export const PANELS: readonly { id: PanelId; label: string; icon: string }[] = [
  { id: "desk", label: "Writing desk", icon: "feather" },
  { id: "board", label: "Writer board", icon: "layout-dashboard" },
  { id: "map", label: "Story map", icon: "git-fork" },
  { id: "timeline", label: "Plot grid", icon: "table" },
  { id: "threads", label: "Story threads", icon: "spline" },
  { id: "manuscript", label: "Manuscript", icon: "book-open" },
];

export interface ShellOptions {
  /** Which panel this is: shown in the jumps, not linked. */
  readonly current: PanelId;
  readonly jump: (to: PanelId) => void;
  /** A docked side column, with the toggle that folds it. Absent for panels without one. */
  readonly side?: { readonly isOpen: () => boolean; readonly onToggle: () => void };
  /** The side column's sections as the writer last left them; absent, every render uses the section's default. */
  readonly sections?: { readonly isOpen: (cls: string) => boolean | undefined; readonly onToggle: (cls: string, open: boolean) => void };
}

/** One entry of the key over the surface: a colour and what it means. */
export interface KeyItem { readonly label: string; readonly color: string; readonly cls?: string }

/** The row of sibling panels, in the fixed order; the current one is shown, not linked. For panels that do not take the whole shell. */
export function renderJumps(parent: HTMLElement, current: PanelId, jump: (to: PanelId) => void): void {
  parent.addClass("czm-shell-jumps");
  parent.setAttribute("role", "navigation");
  parent.setAttribute("aria-label", "Other panels");
  for (const p of PANELS) {
    const here = p.id === current;
    const b = parent.createEl("button", { cls: `clickable-icon czm-shell-jump${here ? " is-current" : ""}`, attr: { "aria-label": here ? `${p.label} (this panel)` : p.label, "data-panel": p.id } });
    if (here) b.setAttribute("aria-current", "page");
    setIcon(b, p.icon);
    if (here) b.disabled = true;
    else b.addEventListener("click", () => jump(p.id));
  }
}

export interface Fix {
  readonly label: string;
  readonly cls?: string;
  readonly onClick: () => void;
}

/**
 * The shell every panel shares, so learning one teaches the other four.
 *
 *   head:  scope (which story, then search) · one state line about what is
 *          shown · icon tools · jumps to the sibling panels, always in the
 *          same order.
 *   body:  the panel's own surface on the left, and a docked side column on
 *          the right for filters and settings, folded by a tool in the head.
 *          Docked, not floating, so it never covers what it filters.
 */
/** One row of a panel's ⋯ menu: the action, the command it is also, and whether it is a toggle that is on. */
export interface MenuEntry {
  readonly label: string;
  readonly icon?: string;
  readonly command?: CommandId;
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

/**
 * The overflow menu every panel shares: each row repeats an action from the head or the side
 * column and names the command it is, so the key for it can be bound in Settings → Hotkeys.
 */
export function showOverflow(ev: MouseEvent, entries: readonly (MenuEntry | "-")[]): Menu {
  const menu = buildMenu(entries);
  menu.showAtMouseEvent(ev);
  return menu;
}

/** The rows of a ⋯ menu, not yet shown: the status bar shows one at a position, the panels at the mouse. */
export function buildMenu(entries: readonly (MenuEntry | "-")[]): Menu {
  const menu = new Menu();
  for (const e of entries) {
    if (e === "-") { menu.addSeparator(); continue; }
    menu.addItem((item) => {
      const title = createFragment();
      title.createSpan({ text: e.label, cls: "czm-menu-label" });
      if (e.command) title.createSpan({ text: commandName(e.command), cls: "czm-menu-cmd" });
      item.setTitle(title);
      if (e.icon) item.setIcon(e.icon);
      if (e.checked !== undefined) item.setChecked(e.checked);
      if (e.disabled) item.setDisabled(true);
      item.onClick(() => e.onClick());
    });
  }
  return menu;
}

/** The ⋯ button: built once, the rows built at each click, so they follow the panel's state. */
export function overflowButton(parent: HTMLElement, build: () => readonly (MenuEntry | "-")[]): HTMLButtonElement {
  const b = parent.createEl("button", { cls: "clickable-icon czm-shell-tool czm-shell-more", attr: { "aria-label": "More actions", "aria-haspopup": "menu" } });
  setIcon(b, "more-horizontal");
  b.addEventListener("click", (ev) => showOverflow(ev, build()));
  return b;
}

export class PanelShell {
  readonly root: HTMLElement;
  readonly head: HTMLElement;
  readonly scope: HTMLElement;
  readonly state: HTMLElement;
  /** Icon tools the panel owns and re-renders. */
  readonly tools: HTMLElement;
  /** The side toggle: created once, never cleared with `tools`. */
  readonly fixed: HTMLElement;
  readonly jumps: HTMLElement;
  readonly body: HTMLElement;
  readonly main: HTMLElement;
  readonly side: HTMLElement;
  private sideToggle: HTMLButtonElement | null = null;
  private keyEl: HTMLElement | null = null;
  private readonly opts: ShellOptions;

  constructor(host: HTMLElement, opts: ShellOptions) {
    this.opts = opts;
    this.root = host.createDiv({ cls: "czm-shell" });
    this.head = this.root.createDiv({ cls: "czm-shell-head" });
    this.scope = this.head.createDiv({ cls: "czm-shell-scope" });
    this.state = this.head.createDiv({ cls: "czm-shell-state", attr: { "aria-live": "polite" } });
    this.tools = this.head.createDiv({ cls: "czm-shell-tools" });
    this.fixed = this.head.createDiv({ cls: "czm-shell-tools czm-shell-fixed" });
    this.jumps = this.head.createDiv({ cls: "czm-shell-jumps" });
    this.body = this.root.createDiv({ cls: "czm-shell-body" });
    this.main = this.body.createDiv({ cls: "czm-shell-main" });
    this.side = this.body.createDiv({ cls: "czm-shell-side czm-map-panel" });
    if (opts.side) {
      const side = opts.side;
      this.sideToggle = this.fixed.createEl("button", { cls: "clickable-icon czm-shell-tool czm-shell-side-toggle", attr: { "aria-label": "Toggle panel" } });
      setIcon(this.sideToggle, "sliders-horizontal");
      this.sideToggle.addEventListener("click", () => { side.onToggle(); this.setSideOpen(side.isOpen()); });
      this.setSideOpen(side.isOpen());
    }
    renderJumps(this.jumps, opts.current, opts.jump);
  }

  /** The ⋯ menu in the head, before the side toggle. */
  overflow(build: () => readonly (MenuEntry | "-")[]): HTMLButtonElement {
    const b = overflowButton(this.fixed, build);
    this.fixed.prepend(b);
    return b;
  }

  setSideOpen(open: boolean): void {
    this.side.classList.toggle("is-open", open);
    this.sideToggle?.setAttribute("aria-expanded", String(open));
    this.sideToggle?.classList.toggle("is-active", open);
  }

  /** An icon button in the head. `pressed` marks a toggle's state. */
  tool(icon: string, label: string, onClick: (ev: MouseEvent) => void, pressed?: boolean): HTMLButtonElement {
    const b = this.tools.createEl("button", { cls: `clickable-icon czm-shell-tool${pressed ? " is-active" : ""}`, attr: { "aria-label": label } });
    if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
    setIcon(b, icon);
    b.addEventListener("click", onClick);
    return b;
  }

  /** The one line about what is shown: "14 nodes · 9 shown · 2 filters on", with a reset when something is filtering. */
  setState(text: string, reset: Fix | null = null): void {
    this.state.empty();
    this.state.createSpan({ text, cls: "czm-shell-state-text" });
    if (reset) {
      const b = this.state.createEl("button", { text: reset.label, cls: `czm-shell-reset${reset.cls ? ` ${reset.cls}` : ""}` });
      b.addEventListener("click", reset.onClick);
    }
  }

  /** A collapsed group in the side column whose header reads its current value, so it can be read without opening. */
  section(title: string, value: string, cls: string, open: boolean): HTMLDetailsElement {
    const d = this.side.createEl("details", { cls: `czm-map-section czm-map-section-${cls}` });
    // As the writer last left it, else the section's own default; a fold or unfold is remembered.
    const want = this.opts.sections?.isOpen(cls) ?? open;
    d.open = want;
    d.addEventListener("toggle", () => { if (d.open !== want) this.opts.sections?.onToggle(cls, d.open); });
    const summary = d.createEl("summary");
    summary.createSpan({ text: title, cls: "czm-map-section-title" });
    if (value) summary.createSpan({ text: value, cls: "czm-map-section-value" });
    return d;
  }

  /** Unfolds a section an action is about to put something in, and remembers it open, so a field the writer asked for is never hidden in a folded section. */
  reveal(cls: string): HTMLDetailsElement | null {
    const d = this.side.querySelector<HTMLDetailsElement>(`details.czm-map-section-${cls}`);
    if (!d) return null;
    if (!d.open) { d.open = true; this.opts.sections?.onToggle(cls, true); }
    return d;
  }

  /** The key in the surface's corner: what each colour on it means. An empty list removes it. */
  key(items: readonly KeyItem[]): void {
    this.keyEl?.remove();
    this.keyEl = null;
    if (!items.length) return;
    this.keyEl = this.main.createDiv({ cls: "czm-shell-key", attr: { "aria-label": "Key" } });
    for (const it of items) {
      const item = this.keyEl.createSpan({ cls: `czm-shell-key-item${it.cls ? ` ${it.cls}` : ""}`, text: it.label });
      item.setCssProps({ "--czm-kind": it.color });
    }
  }

  /** An empty state over the main surface that names its cause and carries the fix. Returns the element; remove it to clear. */
  empty(text: string, fixes: readonly Fix[] = [], cls = ""): HTMLElement {
    const box = this.main.createDiv({ cls: `czm-shell-empty${cls ? ` ${cls}` : ""}`, attr: { role: "status" } });
    box.createEl("p", { text, cls: "czm-map-empty" });
    if (fixes.length) {
      const row = box.createDiv({ cls: "czm-shell-empty-fixes" });
      for (const f of fixes) {
        const b = row.createEl("button", { text: f.label, cls: `czm-shell-fix${f.cls ? ` ${f.cls}` : ""}` });
        b.addEventListener("click", f.onClick);
      }
    }
    return box;
  }
}
