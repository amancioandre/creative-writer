/**
 * Obsidian augments Node with createEl/createDiv/createSpan (so SVG elements
 * have them too), HTMLElement with empty/setCssStyles/setCssProps, and exposes
 * createDiv/createEl globally. jsdom does not; this mirrors the subset we use.
 */
type Opts = { text?: string; cls?: string; attr?: Record<string, string>; title?: string };
function make<K extends keyof HTMLElementTagNameMap>(tag: K, o?: Opts): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text !== undefined) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  if (o?.title !== undefined) el.title = o.title;
  if (o?.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
  return el;
}
const node = Node.prototype as Node & { createEl?: unknown; createDiv?: unknown; createSpan?: unknown };
node.createEl = function <K extends keyof HTMLElementTagNameMap>(this: Node, tag: K, o?: Opts) { const c = make(tag, o); this.appendChild(c); return c; };
node.createDiv = function (this: Node, o?: Opts) { return this.createEl("div", o); };
node.createSpan = function (this: Node, o?: Opts) { return this.createEl("span", o); };
const proto = HTMLElement.prototype as HTMLElement & { addClass?: unknown; empty?: unknown; setCssStyles?: unknown; setCssProps?: unknown; setText?: unknown };
proto.addClass = function (this: HTMLElement, c: string) { this.classList.add(c); };
proto.empty = function (this: HTMLElement) { this.replaceChildren(); };
proto.setCssStyles = function (this: HTMLElement, styles: Partial<CSSStyleDeclaration>) { Object.assign(this.style, styles); };
proto.setCssProps = function (this: HTMLElement, props: Record<string, string>) { for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v); };
proto.setText = function (this: HTMLElement, t: string) { this.textContent = t; };
(globalThis as Record<string, unknown>).createEl = make;
(globalThis as Record<string, unknown>).createDiv = (o?: Opts) => make("div", o);
(globalThis as Record<string, unknown>).createSpan = (o?: Opts) => make("span", o);
