/**
 * Minimal stand-in for the `obsidian` package, which ships types only and
 * cannot be imported at test time. Only what the adapters touch is modelled.
 */
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
  constructor(public containerEl: HTMLElement) { Setting.created.push(this); }
  setName(n: string) { this.name = n; return this; }
  desc = "";
  setDesc(d: string) { this.desc = d; return this; }
  setHeading() { return this; }
  addToggle(cb: (t: ToggleComponent) => unknown) { this.toggle = new ToggleComponent(); cb(this.toggle); return this; }
  addSlider(cb: (s: SliderComponent) => unknown) { this.slider = new SliderComponent(); cb(this.slider); return this; }
  dropdown?: DropdownComponent;
  text?: TextComponent;
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
export class WorkspaceLeaf {}
export class ItemView {
  contentEl: HTMLElement = document.createElement("div");
  constructor(public leaf: WorkspaceLeaf) {}
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
  getIcon(): string { return ""; }
}

declare global {
  interface HTMLElement {
    empty(): void;
    createEl(tag: string, o?: { text?: string; cls?: string }): HTMLElement;
    createDiv(o?: { text?: string; cls?: string }): HTMLElement;
  }
  function createEl(tag: string, o?: { text?: string; cls?: string }): HTMLElement;
  function createDiv(o?: { text?: string; cls?: string }): HTMLElement;
  function createSpan(o?: { text?: string; cls?: string }): HTMLElement;
}

export type SettingDefinitionItem = unknown;
