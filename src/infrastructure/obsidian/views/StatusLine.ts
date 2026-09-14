/** How long a passing message stays, and how long an undo is offered. */
export const SAY_MS = 4000;
export const UNDO_MS = 8000;

/**
 * The one line at the bottom of a panel that says what just happened.
 *
 * Three registers: a passing message (gone after a few seconds), an action
 * the writer can take back (the message plus an Undo button, offered a little
 * longer), and a failure (stays until something else happens, announced
 * assertively). The element is a polite live region, so a screen reader hears
 * the message without the panel stealing focus.
 */
export class StatusLine {
  readonly el: HTMLElement;
  private message = "";
  private timer: number | null = null;

  constructor(parent: HTMLElement) {
    this.el = parent.createDiv({ cls: "czm-map-status", attr: { "aria-live": "polite" } });
  }

  get text(): string {
    return this.message;
  }

  /** A passing message. */
  say(message: string): void {
    this.render(message, null, false);
    this.expire(SAY_MS);
  }

  /** A state the panel is in (link mode, a reading in progress, its result): stays until replaced or cleared. */
  hold(message: string): void {
    this.render(message, null, false);
  }

  /** Something done that can be taken back: `undo` runs when the button is pressed. */
  undoable(message: string, undo: () => Promise<void>): void {
    this.render(message, undo, false);
    this.expire(UNDO_MS);
  }

  /** Something done, with one thing to do about it that is not an undo: "Wrote Plot grid · 2026-09-13.md" with Open. */
  action(message: string, label: string, run: () => void): void {
    this.render(message, null, false);
    const btn = this.el.createEl("button", { text: label, cls: "czm-status-undo czm-status-action" });
    btn.addEventListener("click", () => { this.clear(); run(); });
    this.expire(UNDO_MS);
  }

  /** A failure: stays until the next message, announced as an alert. Say what could not be done and why. */
  fail(message: string): void {
    this.render(message, null, true);
  }

  clear(): void {
    this.render("", null, false);
  }

  private expire(ms: number): void {
    const shown = this.message;
    this.timer = window.setTimeout(() => { if (this.message === shown) this.clear(); }, ms);
  }

  private render(message: string, undo: (() => Promise<void>) | null, error: boolean): void {
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    this.message = message;
    this.el.empty();
    this.el.classList.toggle("is-open", message.length > 0);
    this.el.classList.toggle("is-error", error);
    if (error) this.el.setAttribute("role", "alert"); else this.el.removeAttribute("role");
    if (!message) return;
    this.el.createSpan({ text: message, cls: "czm-status-text" });
    if (undo) {
      const btn = this.el.createEl("button", { text: "Undo", cls: "czm-status-undo" });
      btn.addEventListener("click", () => {
        this.clear();
        void undo().catch((e: unknown) => this.fail(`Could not undo: ${e instanceof Error ? e.message : String(e)}`));
      });
    }
  }
}

/** One sentence for a caught error: what could not be done, and the reason the code gave. */
export function couldNot(what: string, e: unknown): string {
  return `Could not ${what}: ${e instanceof Error ? e.message : String(e)}`;
}
