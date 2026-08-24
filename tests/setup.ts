/**
 * Obsidian augments HTMLElement with createEl/createDiv/empty and exposes
 * createDiv/createEl globally. jsdom does not; this mirrors the subset we use.
 */
type Opts = { text?: string; cls?: string };
function make(tag: string, o?: Opts): HTMLElement {
  const el = document.createElement(tag);
  if (o?.text !== undefined) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  return el;
}
const proto = HTMLElement.prototype as HTMLElement & { createEl?: unknown; createDiv?: unknown; empty?: unknown };
proto.createEl = function (this: HTMLElement, tag: string, o?: Opts) { const c = make(tag, o); this.appendChild(c); return c; };
proto.createDiv = function (this: HTMLElement, o?: Opts) { return this.createEl("div", o); };
proto.createSpan = function (this: HTMLElement, o?: Opts) { return this.createEl("span", o); };
proto.addClass = function (this: HTMLElement, c: string) { this.classList.add(c); };
proto.empty = function (this: HTMLElement) { this.replaceChildren(); };
(globalThis as Record<string, unknown>).createEl = make;
(globalThis as Record<string, unknown>).createDiv = (o?: Opts) => make("div", o);
(globalThis as Record<string, unknown>).createSpan = (o?: Opts) => make("span", o);
