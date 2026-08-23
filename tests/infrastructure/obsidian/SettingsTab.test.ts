import { describe, it, expect, beforeEach } from "vitest";
import { App, Plugin, Setting } from "obsidian";
import { CreativeZenSettingsTab } from "../../../src/infrastructure/obsidian/SettingsTab";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../../src/domain/settings/Settings";

describe("CreativeZenSettingsTab", () => {
  let saved: PluginSettings[];
  let tab: CreativeZenSettingsTab;

  beforeEach(() => {
    Setting.created = [];
    saved = [];
    tab = new CreativeZenSettingsTab(new App(), new Plugin(), {
      current: () => DEFAULT_SETTINGS,
      update: async (s) => { saved.push(s); },
    });
    tab.display();
  });

  it("renders a control for every setting", () => {
    const names = Setting.created.map((s) => s.name).filter(Boolean);
    expect(names).toEqual(
      expect.arrayContaining(["Typewriter scrolling", "Focus fade", "Paragraph rhythm", "Rhythm tiers", "Fullscreen in Zen Mode", "Style checks", "Clichés", "Passive voice", "Weak words", "Filter verbs", "Adverbs", "Repetition", "Nominalisations", "Weak verbs", "Metaphor candidates", "Model", "Analyse automatically", "Ollama URL", "Ollama model"]),
    );
  });

  it("seeds controls from current settings", () => {
    const tiers = Setting.created.find((s) => s.name === "Rhythm tiers")!.slider!;
    expect(tiers.value).toBe(DEFAULT_SETTINGS.rhythmTiers);
  });

  it("persists a change through the settings port", async () => {
    const toggle = Setting.created.find((s) => s.name === "Typewriter scrolling")!.toggle!;
    await toggle.onChangeCb(false);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.typewriterEnabled).toBe(false);
  });

  it("persists slider changes", async () => {
    const slider = Setting.created.find((s) => s.name === "Rhythm tiers")!.slider!;
    await slider.onChangeCb(4);
    expect(saved[0]!.rhythmTiers).toBe(4);
  });

  it("persists a per-kind style toggle", async () => {
    const toggle = Setting.created.find((s) => s.name === "Passive voice")!.toggle!;
    await toggle.onChangeCb(false);
    expect(saved[0]!.styleChecks.passive).toBe(false);
    expect(saved[0]!.styleChecks.cliche).toBe(true);
  });

  it("persists the model provider and text fields", async () => {
    await Setting.created.find((s) => s.name === "Model")!.dropdown!.onChangeCb("ollama");
    await Setting.created.find((s) => s.name === "Ollama model")!.text!.onChangeCb("llama3.1:8b");
    expect(saved[0]!.llm.provider).toBe("ollama");
    expect(saved[1]!.llm.ollamaModel).toBe("llama3.1:8b");
  });
});
