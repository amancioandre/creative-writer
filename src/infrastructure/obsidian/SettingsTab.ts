import { type App, type Plugin, PluginSettingTab, Setting } from "obsidian";
import { RhythmScale } from "../../domain/rhythm/RhythmScale";
import type { PluginSettings } from "../../domain/settings/Settings";

/** What the tab needs from the outside world — not the whole plugin. */
export interface SettingsPort {
  current(): PluginSettings;
  update(next: PluginSettings): Promise<void>;
}

export class CreativeZenSettingsTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private readonly port: SettingsPort) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.port.current();
    const set = (patch: Partial<PluginSettings>) => this.port.update({ ...this.port.current(), ...patch });

    new Setting(containerEl)
      .setName("Typewriter scrolling")
      .setDesc("Keep the line you are writing vertically centred.")
      .addToggle((t) => t.setValue(s.typewriterEnabled).onChange((v) => set({ typewriterEnabled: v })));

    new Setting(containerEl)
      .setName("Focus fade")
      .setDesc("Fade lines progressively the further they are from the cursor.")
      .addToggle((t) => t.setValue(s.focusFadeEnabled).onChange((v) => set({ focusFadeEnabled: v })));

    new Setting(containerEl)
      .setName("Paragraph rhythm")
      .setDesc("Colour each sentence of the current paragraph by its length and weight.")
      .addToggle((t) => t.setValue(s.rhythmEnabled).onChange((v) => set({ rhythmEnabled: v })));

    new Setting(containerEl)
      .setName("Rhythm tiers")
      .setDesc("How many colour steps the rhythm gradient uses.")
      .addSlider((sl) =>
        sl
          .setLimits(RhythmScale.MIN_TIERS, RhythmScale.MAX_TIERS, 1)
          .setValue(s.rhythmTiers)
          .setDynamicTooltip()
          .onChange((v) => set({ rhythmTiers: v })),
      );

    new Setting(containerEl)
      .setName("Fullscreen in Zen Mode")
      .setDesc("Also request window fullscreen when Zen Mode is toggled on.")
      .addToggle((t) => t.setValue(s.zenFullscreen).onChange((v) => set({ zenFullscreen: v })));
  }
}
