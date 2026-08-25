import { describe, it, expect, beforeEach } from "vitest";
import { App, Plugin, Setting } from "obsidian";
import { CreativeZenSettingsTab } from "../../../src/infrastructure/obsidian/SettingsTab";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../../src/domain/settings/Settings";

const names = (items: unknown[]): string[] =>
  items.flatMap((i) => {
    const o = i as { name?: string; items?: unknown[] };
    return o.items ? names(o.items) : o.name ? [o.name] : [];
  });

describe("CreativeZenSettingsTab", () => {
  let saved: PluginSettings[];
  let current: PluginSettings;
  let tab: CreativeZenSettingsTab;

  beforeEach(() => {
    Setting.created = [];
    saved = [];
    current = DEFAULT_SETTINGS;
    tab = new CreativeZenSettingsTab(new App(), new Plugin(), {
      current: () => current,
      update: async (s) => { saved.push(s); current = s; },
      configDir: () => ".obsidian-custom",
      scopeSummary: () => ({ counted: 3, total: 5 }),
    });
  });

  describe("declarative definitions (Obsidian ≥ 1.13)", () => {
    it("tells the writer how many notes the scope takes in and offers the project-folders mode", () => {
      type Item = { name?: string; desc?: string; control?: { options?: Record<string, string> }; items?: Item[] };
      const notes = (tab.getSettingDefinitions() as Item[]).flatMap((d) => d.items ?? [d]).find((d) => d.name === "Notes")!;
      expect(notes.desc).toContain("3 of 5 notes");
      expect(notes.control?.options).toHaveProperty("projects");
    });
    it("declares every setting with a searchable name", () => {
      const all = names(tab.getSettingDefinitions());
      expect(all).toEqual(expect.arrayContaining([
        "Enabled", "Notes", "Folders", "Typewriter scrolling", "Current line", "Focus fade", "Paragraph strength", "Far text strength", "Paragraph rhythm", "Rhythm tiers", "Fullscreen in Zen Mode",
        "Style checks", "Clichés", "Passive voice", "Filter verbs", "Adverbs", "Repetition", "Nominalisations", "Weak verbs", "Metaphor candidates",
        "Model", "Analyse automatically", "Ollama URL", "Ollama model", "Claude model", "Anthropic API key", "Daily spending cap (USD)",
      ]));
    });

    it("reads values through dotted keys", () => {
      expect(tab.getControlValue("typewriterEnabled")).toBe(true);
      expect(tab.getControlValue("styleChecks.passive")).toBe(true);
      expect(tab.getControlValue("llm.ollamaModel")).toBe("qwen2.5:7b");
      expect(tab.getControlValue("nope.nope")).toBeUndefined();
    });

    it("writes values through dotted keys without clobbering siblings", async () => {
      await tab.setControlValue("styleChecks.passive", false);
      await tab.setControlValue("llm.provider", "ollama");
      expect(saved[1]!.styleChecks.passive).toBe(false);
      expect(saved[1]!.styleChecks.cliche).toBe(true);
      expect(saved[1]!.llm.provider).toBe("ollama");
      expect(saved[1]!.llm.ollamaModel).toBe("qwen2.5:7b");
    });

    it("uses the vault's configured folder in the plaintext-key warning", () => {
      const key = names(tab.getSettingDefinitions()).includes("Anthropic API key");
      expect(key).toBe(true);
      const def = JSON.stringify(tab.getSettingDefinitions());
      expect(def).toContain(".obsidian-custom/plugins/creative-writer/data.json");
      expect(def).toMatch(/PLAINTEXT/);
    });
  });

  describe("legacy renderer (Obsidian < 1.13)", () => {
    beforeEach(() => tab.renderLegacy());

    it("renders a control for every setting", () => {
      const created = Setting.created.map((s) => s.name).filter(Boolean);
      expect(created).toEqual(expect.arrayContaining(["Typewriter scrolling", "Rhythm tiers", "Passive voice", "Model", "Anthropic API key"]));
    });

    it("seeds controls and persists changes", async () => {
      expect(Setting.created.find((s) => s.name === "Rhythm tiers")!.slider!.value).toBe(DEFAULT_SETTINGS.rhythmTiers);
      await Setting.created.find((s) => s.name === "Typewriter scrolling")!.toggle!.onChangeCb(false);
      await Setting.created.find((s) => s.name === "Passive voice")!.toggle!.onChangeCb(false);
      await Setting.created.find((s) => s.name === "Model")!.dropdown!.onChangeCb("ollama");
      expect(saved[0]!.typewriterEnabled).toBe(false);
      expect(saved[1]!.styleChecks.passive).toBe(false);
      expect(saved[1]!.styleChecks.cliche).toBe(true);
      expect(saved[2]!.llm.provider).toBe("ollama");
    });
  });

  it("display() falls back to the legacy renderer when the app has no base display()", () => {
    tab.display();
    expect(Setting.created.length).toBeGreaterThan(0);
  });
});
