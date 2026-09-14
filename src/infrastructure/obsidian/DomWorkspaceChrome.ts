import type { WorkspaceChrome } from "../../application/ports/WorkspaceChrome";

export const ZEN_BODY_CLASS = "czm-zen";
export const ZEN_HUD_CLASS = "czm-zen-hud";
/** How long the indicator stays after the mouse stops. */
export const HUD_MS = 2000;
/** After a keystroke the indicator stays away from the next mouse move for this long: typing is not asking. */
const TYPING_MS = 400;

export interface ZenIndicator {
  /** Words added today, for the one figure the indicator shows. */
  wordsToday(): number;
  /** Leaves Zen Mode; wired to the toggle. */
  leave(): void;
}

/**
 * Implements the chrome port against Obsidian's DOM. Hiding is done purely by
 * toggling a body class — styles.css decides what disappears — so the plugin
 * never reaches into Obsidian's workspace internals.
 */
export class DomWorkspaceChrome implements WorkspaceChrome {
  private hud: HTMLElement | null = null;
  private hudTimer: number | null = null;
  private typingUntil = 0;

  constructor(private readonly doc: Document, private readonly indicator?: ZenIndicator) {}

  hideChrome(): void {
    this.doc.body.classList.add(ZEN_BODY_CLASS);
    if (this.indicator) {
      this.doc.addEventListener("mousemove", this.onMove);
      this.doc.addEventListener("keydown", this.onKey, true);
    }
  }

  showChrome(): void {
    this.doc.body.classList.remove(ZEN_BODY_CLASS);
    this.doc.removeEventListener("mousemove", this.onMove);
    this.doc.removeEventListener("keydown", this.onKey, true);
    this.dropHud();
  }

  /** The one indicator Zen Mode admits: today's words and the way out, on mouse move, gone two seconds later. Never while typing. */
  private readonly onMove = (): void => {
    if (Date.now() < this.typingUntil) return;
    this.showHud();
  };

  private readonly onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") {
      // Escape leaves Zen Mode from the page itself, and only when nothing else is waiting for it: a menu, a prompt, a suggestion.
      if (!this.inEditor(ev.target) || this.somethingOpen()) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.indicator?.leave();
      return;
    }
    this.typingUntil = Date.now() + TYPING_MS;
    this.hideHud();
  };

  private inEditor(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(".cm-editor");
  }

  private somethingOpen(): boolean {
    return !!this.doc.querySelector(".modal-container, .suggestion-container, .menu, .prompt");
  }

  private showHud(): void {
    if (!this.indicator) return;
    if (!this.hud) this.hud = this.doc.body.createDiv({ cls: ZEN_HUD_CLASS, attr: { "aria-hidden": "true" } });
    const n = this.indicator.wordsToday();
    this.hud.setText(`${n === 0 ? "No words yet today" : `${n.toLocaleString()} word${n === 1 ? "" : "s"} today`} · Esc leaves Zen Mode`);
    this.hud.classList.add("is-shown");
    if (this.hudTimer !== null) window.clearTimeout(this.hudTimer);
    this.hudTimer = window.setTimeout(() => { this.hudTimer = null; this.hideHud(); }, HUD_MS);
  }

  private hideHud(): void {
    if (this.hudTimer !== null) { window.clearTimeout(this.hudTimer); this.hudTimer = null; }
    this.hud?.classList.remove("is-shown");
  }

  private dropHud(): void {
    this.hideHud();
    this.hud?.remove();
    this.hud = null;
  }

  async enterFullscreen(): Promise<void> {
    const root = this.doc.documentElement;
    if (typeof root.requestFullscreen !== "function") return;
    await root.requestFullscreen();
  }

  async exitFullscreen(): Promise<void> {
    if (typeof this.doc.exitFullscreen !== "function") return;
    if (!this.doc.fullscreenElement) return;
    await this.doc.exitFullscreen();
  }
}
