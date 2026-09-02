/**
 * Minimal stand-in for the `obsidian` package, which ships types only and
 * cannot be imported at test time. Only what the adapters touch is modelled.
 */
import { StateField } from "@codemirror/state";

/** Obsidian's per-editor info; tests set a file path through `withFile`. */
export const editorInfoField = StateField.define<{ file: { path: string } | null }>({
  create: () => ({ file: null }),
  update: (v) => v,
});
export const withFile = (path: string | null) => editorInfoField.init(() => ({ file: path ? { path } : null }));

export class App {}
export class Plugin {
  app = new App();
  private data: unknown = undefined;
  async loadData(): Promise<unknown> { return this.data; }
  async saveData(d: unknown): Promise<void> { this.data = d; }
}
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement("div");
  constructor(public app: App, public plugin: Plugin) {}
  hide(): void {}
}
type ToggleCb = (v: boolean) => unknown;
type SliderCb = (v: number) => unknown;
export class ToggleComponent {
  value = false;
  onChangeCb: ToggleCb = () => undefined;
  setValue(v: boolean) { this.value = v; return this; }
  onChange(cb: ToggleCb) { this.onChangeCb = cb; return this; }
}
export class SliderComponent {
  value = 0;
  onChangeCb: SliderCb = () => undefined;
  setLimits(_min: number, _max: number, _step: number) { return this; }
  setValue(v: number) { this.value = v; return this; }
  setDynamicTooltip() { return this; }
  onChange(cb: SliderCb) { this.onChangeCb = cb; return this; }
}
export class Setting {
  static created: Setting[] = [];
  name = "";
  toggle?: ToggleComponent;
  slider?: SliderComponent;
  constructor(public containerEl: HTMLElement) { this.settingEl = containerEl.createDiv({ cls: "setting-item" }); Setting.created.push(this); }
  setName(n: string) { this.name = n; return this; }
  desc = "";
  setDesc(d: string) { this.desc = d; return this; }
  setHeading() { return this; }
  addToggle(cb: (t: ToggleComponent) => unknown) { this.toggle = new ToggleComponent(); cb(this.toggle); return this; }
  addSlider(cb: (s: SliderComponent) => unknown) { this.slider = new SliderComponent(); cb(this.slider); return this; }
  dropdown?: DropdownComponent;
  text?: TextComponent;
  color?: ColorComponent;
  button?: ButtonComponent;
  settingEl!: HTMLElement;
  setClass(c: string) { this.settingEl.classList.add(c); return this; }
  addColorPicker(cb: (c: ColorComponent) => unknown) { this.color = new ColorComponent(); cb(this.color); return this; }
  addButton(cb: (b: ButtonComponent) => unknown) { this.button = new ButtonComponent(this.settingEl); cb(this.button); return this; }
  addExtraButton(cb: (b: ButtonComponent) => unknown) { cb(new ButtonComponent(this.settingEl)); return this; }
  addDropdown(cb: (d: DropdownComponent) => unknown) { this.dropdown = new DropdownComponent(); cb(this.dropdown); return this; }
  addText(cb: (t: TextComponent) => unknown) { this.text = new TextComponent(); cb(this.text); return this; }
}
export async function requestUrl(_req: unknown): Promise<{ status: number; json: unknown }> {
  return { status: 200, json: {} };
}
export class Notice {
  static shown: string[] = [];
  constructor(message: string) { Notice.shown.push(message); }
}
type DropdownCb = (v: string) => unknown;
type TextCb = (v: string) => unknown;
export class DropdownComponent {
  value = "";
  options: Record<string, string> = {};
  onChangeCb: DropdownCb = () => undefined;
  addOptions(o: Record<string, string>) { this.options = o; return this; }
  setValue(v: string) { this.value = v; return this; }
  onChange(cb: DropdownCb) { this.onChangeCb = cb; return this; }
}
export class TextComponent {
  value = "";
  onChangeCb: TextCb = () => undefined;
  setPlaceholder(_p: string) { return this; }
  setValue(v: string) { this.value = v; return this; }
  onChange(cb: TextCb) { this.onChangeCb = cb; return this; }
}
export class ColorComponent {
  value = "";
  onChangeCb: TextCb = () => undefined;
  setValue(v: string) { this.value = v; return this; }
  onChange(cb: TextCb) { this.onChangeCb = cb; return this; }
}
export class ButtonComponent {
  buttonEl: HTMLElement;
  constructor(parent: HTMLElement) { this.buttonEl = parent.createEl("button"); }
  setButtonText(t: string) { this.buttonEl.textContent = t; return this; }
  setIcon(_i: string) { return this; }
  setTooltip(t: string) { this.buttonEl.title = t; return this; }
  setCta() { return this; }
  setDisabled(d: boolean) { (this.buttonEl as HTMLButtonElement).disabled = d; return this; }
  onClick(cb: () => unknown) { this.buttonEl.addEventListener("click", () => cb()); return this; }
}
export function setIcon(el: HTMLElement, icon: string): void { el.setAttribute("data-icon", icon); }
export class MenuItem {
  title = "";
  cb: () => unknown = () => undefined;
  setTitle(t: string) { this.title = t; return this; }
  setIcon(_i: string) { return this; }
  onClick(cb: () => unknown) { this.cb = cb; return this; }
}
export class Menu {
  static last: Menu | null = null;
  items: MenuItem[] = [];
  addItem(cb: (i: MenuItem) => unknown) { const i = new MenuItem(); cb(i); this.items.push(i); return this; }
  addSeparator() { return this; }
  showAtMouseEvent(_e: MouseEvent) { Menu.last = this; return this; }
}
export class WorkspaceLeaf {}
export interface DataAdapter { exists(p: string): Promise<boolean>; read(p: string): Promise<string>; write(p: string, d: string): Promise<void>; }
export class ItemView {
  containerEl: HTMLElement = document.createElement("div");
  contentEl: HTMLElement = document.createElement("div");
  constructor(public leaf: WorkspaceLeaf) {}
  register(_cb: () => void): void {}
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
  getIcon(): string { return ""; }
}

declare global {
  interface HTMLElement {
    addClass(cls: string): void;
    empty(): void;
    setText(text: string): void;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomOpts): HTMLElementTagNameMap[K];
    createDiv(o?: DomOpts): HTMLElement;
    createSpan(o?: DomOpts): HTMLElement;
  }
  type DomOpts = { text?: string; cls?: string; attr?: Record<string, string> };
  function createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomOpts): HTMLElementTagNameMap[K];
  function createDiv(o?: DomOpts): HTMLElement;
  function createSpan(o?: DomOpts): HTMLElement;
}

export type SettingDefinitionItem = unknown;
