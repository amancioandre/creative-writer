import { type App, type Plugin, PluginSettingTab, Setting } from "obsidian";
import { RhythmScale } from "../../domain/rhythm/RhythmScale";
import type { LlmProvider, PluginSettings } from "../../domain/settings/Settings";
import type { FindingKind } from "../../domain/style/Finding";

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

    new Setting(containerEl).setName("Style checks").setHeading();

    new Setting(containerEl)
      .setName("Style checks")
      .setDesc("Highlight clichés, passive voice, weak words, filter verbs, adverbs and repetition in the current paragraph. Hover a highlight for the note.")
      .addToggle((t) => t.setValue(s.styleEnabled).onChange((v) => set({ styleEnabled: v })));

    const checks: ReadonlyArray<[FindingKind, string, string]> = [
      ["cliche", "Clichés", "Phrases worn smooth by overuse."],
      ["passive", "Passive voice", "\"The letter was written\" — by whom?"],
      ["weak", "Weak words", "Intensifiers, hedges and filler: very, quite, just, started to…"],
      ["filter", "Filter verbs", "saw, heard, felt, realised — narrating perception instead of rendering it."],
      ["adverb", "Adverbs", "-ly adverbs, especially on dialogue tags."],
      ["repetition", "Repetition", "A word echoed within thirty words, or three sentences opening alike."],
      ["nominalization", "Nominalisations", "\"made a decision\" → \"decided\"; the action hiding inside a noun."],
      ["weakverb", "Weak verbs", "A long sentence carried only by \"was\" or \"is\"."],
      ["metaphor", "Metaphor candidates", "A concrete word applied to an abstract one — possibly figurative. Fresh or tired is your call."],
    ];
    for (const [kind, name, desc] of checks) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle((t) =>
          t.setValue(s.styleChecks[kind]).onChange((v) => set({ styleChecks: { ...this.port.current().styleChecks, [kind]: v } })),
        );
    }

    new Setting(containerEl).setName("Model assistant").setHeading();

    new Setting(containerEl)
      .setName("Model")
      .setDesc("A language model reads the current paragraph and adds findings the rules cannot see: clichés in context, tired metaphors, passives that hide an agent. Local Ollama keeps everything on this machine.")
      .addDropdown((d) =>
        d.addOptions({ off: "Off", ollama: "Local (Ollama)" }).setValue(s.llm.provider).onChange((v) => set({ llm: { ...this.port.current().llm, provider: v as LlmProvider } })),
      );

    new Setting(containerEl)
      .setName("Analyse automatically")
      .setDesc("Run the model after a pause in typing. Off: only when you run the \"Analyse paragraph with model\" command.")
      .addToggle((t) => t.setValue(s.llm.onIdle).onChange((v) => set({ llm: { ...this.port.current().llm, onIdle: v } })));

    new Setting(containerEl)
      .setName("Pause before analysing")
      .setDesc("Milliseconds of quiet before the model is called.")
      .addSlider((sl) => sl.setLimits(500, 10000, 250).setValue(s.llm.idleMs).setDynamicTooltip().onChange((v) => set({ llm: { ...this.port.current().llm, idleMs: v } })));

    new Setting(containerEl)
      .setName("Ollama URL")
      .addText((t) => t.setPlaceholder("http://localhost:11434").setValue(s.llm.ollamaUrl).onChange((v) => set({ llm: { ...this.port.current().llm, ollamaUrl: v } })));

    new Setting(containerEl)
      .setName("Ollama model")
      .setDesc("Any chat model you have pulled. qwen2.5:7b and llama3.1:8b follow the JSON format well; reasoning models (deepseek-r1) are slower and less reliable here.")
      .addText((t) => t.setPlaceholder("qwen2.5:7b").setValue(s.llm.ollamaModel).onChange((v) => set({ llm: { ...this.port.current().llm, ollamaModel: v } })));
  }
}
