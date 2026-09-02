/**
 * Obsidian augments HTMLElement with createEl/createDiv/empty and exposes
 * createDiv/createEl globally. jsdom does not; this mirrors the subset we use.
 */
type Opts = { text?: string; cls?: string; attr?: Record<string, string> };
function make<K extends keyof HTMLElementTagNameMap>(tag: K, o?: Opts): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text !== undefined) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  if (o?.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
  return el;
}
const proto = HTMLElement.prototype as HTMLElement & { createEl?: unknown; createDiv?: unknown; empty?: unknown };
proto.createEl = function <K extends keyof HTMLElementTagNameMap>(this: HTMLElement, tag: K, o?: Opts) { const c = make(tag, o); this.appendChild(c); return c; };
proto.createDiv = function (this: HTMLElement, o?: Opts) { return this.createEl("div", o); };
proto.createSpan = function (this: HTMLElement, o?: Opts) { return this.createEl("span", o); };
proto.addClass = function (this: HTMLElement, c: string) { this.classList.add(c); };
proto.empty = function (this: HTMLElement) { this.replaceChildren(); };
(proto as HTMLElement & { setCssStyles?: unknown }).setCssStyles = function (this: HTMLElement, styles: Partial<CSSStyleDeclaration>) { Object.assign(this.style, styles); };
(proto as HTMLElement & { setText?: unknown }).setText = function (this: HTMLElement, t: string) { this.textContent = t; };
(globalThis as Record<string, unknown>).createEl = make;
(globalThis as Record<string, unknown>).createDiv = (o?: Opts) => make("div", o);
(globalThis as Record<string, unknown>).createSpan = (o?: Opts) => make("span", o);
