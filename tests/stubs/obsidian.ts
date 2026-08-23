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
  containerEl: HTMLElement & { empty(): void };
  constructor(public app: App, public plugin: Plugin) {
    const el = document.createElement("div") as unknown as HTMLElement & { empty(): void };
    el.empty = () => el.replaceChildren();
    this.containerEl = el;
  }
  display(): void {}
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
  setDesc(_d: string) { return this; }
  setHeading() { return this; }
  addToggle(cb: (t: ToggleComponent) => unknown) { this.toggle = new ToggleComponent(); cb(this.toggle); return this; }
  addSlider(cb: (s: SliderComponent) => unknown) { this.slider = new SliderComponent(); cb(this.slider); return this; }
}
