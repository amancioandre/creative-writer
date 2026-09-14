import { setIcon } from "obsidian";

/** The panels a writer moves between, in the order they are offered everywhere. */
export type PanelId = "desk" | "board" | "map" | "timeline" | "threads" | "manuscript";

export const PANELS: readonly { id: PanelId; label: string; icon: string }[] = [
  { id: "desk", label: "Writing desk", icon: "feather" },
  { id: "board", label: "Writer board", icon: "layout-dashboard" },
  { id: "map", label: "Story map", icon: "git-fork" },
  { id: "timeline", label: "Story timeline", icon: "gantt-chart" },
  { id: "threads", label: "Story threads", icon: "spline" },
  { id: "manuscript", label: "Manuscript", icon: "book-open" },
];

export interface ShellOptions {
  /** Which panel this is: shown in the jumps, not linked. */
  readonly current: PanelId;
  readonly jump: (to: PanelId) => void;
  /** A docked side column, with the toggle that folds it. Absent for panels without one. */
  readonly side?: { readonly isOpen: () => boolean; readonly onToggle: () => void };
}

/** The row of sibling panels, in the fixed order; the current one is shown, not linked. For panels that do not take the whole shell. */
export function renderJumps(parent: HTMLElement, current: PanelId, jump: (to: PanelId) => void): void {
  parent.addClass("czm-shell-jumps");
  parent.setAttribute("role", "navigation");
  parent.setAttribute("aria-label", "Other panels");
  for (const p of PANELS) {
    const here = p.id === current;
    const b = parent.createEl("button", { cls: `clickable-icon czm-shell-jump${here ? " is-current" : ""}`, attr: { "aria-label": here ? `${p.label} (this panel)` : p.label, title: p.label, "data-panel": p.id } });
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

  constructor(host: HTMLElement, opts: ShellOptions) {
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
      this.sideToggle = this.fixed.createEl("button", { cls: "clickable-icon czm-shell-tool czm-shell-side-toggle", attr: { "aria-label": "Toggle panel", title: "Toggle panel" } });
      setIcon(this.sideToggle, "sliders-horizontal");
      this.sideToggle.addEventListener("click", () => { side.onToggle(); this.setSideOpen(side.isOpen()); });
      this.setSideOpen(side.isOpen());
    }
    renderJumps(this.jumps, opts.current, opts.jump);
  }

  setSideOpen(open: boolean): void {
    this.side.classList.toggle("is-open", open);
    this.sideToggle?.setAttribute("aria-expanded", String(open));
    this.sideToggle?.classList.toggle("is-active", open);
  }

  /** An icon button in the head. `pressed` marks a toggle's state. */
  tool(icon: string, label: string, onClick: (ev: MouseEvent) => void, pressed?: boolean): HTMLButtonElement {
    const b = this.tools.createEl("button", { cls: `clickable-icon czm-shell-tool${pressed ? " is-active" : ""}`, attr: { "aria-label": label, title: label } });
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
    d.open = open;
    const summary = d.createEl("summary");
    summary.createSpan({ text: title, cls: "czm-map-section-title" });
    if (value) summary.createSpan({ text: value, cls: "czm-map-section-value" });
    return d;
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
