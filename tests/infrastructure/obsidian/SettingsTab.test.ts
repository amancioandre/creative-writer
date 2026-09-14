import { stripPresetOf } from "../../../src/infrastructure/obsidian/SettingsTab";
import { describe, it, expect, beforeEach } from "vitest";
import { App, Plugin, Setting } from "obsidian";
import { CreativeZenSettingsTab } from "../../../src/infrastructure/obsidian/SettingsTab";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../../src/domain/settings/Settings";

type Item = { name?: string; desc?: string; heading?: string; control?: { type?: string; key?: string; options?: Record<string, string> }; render?: unknown; visible?: () => boolean; items?: Item[] };

const names = (items: unknown[]): string[] =>
  items.flatMap((i) => {
    const o = i as { name?: string; items?: unknown[] };
    return o.items ? names(o.items) : o.name ? [o.name] : [];
  });

describe("CreativeZenSettingsTab", () => {
  let saved: PluginSettings[];
  let current: PluginSettings;
  let tab: CreativeZenSettingsTab;
  const defs = () => tab.getSettingDefinitions() as Item[];
  const flat = () => defs().flatMap((d) => d.items ?? [d]);
  const row = (name: string) => flat().find((d) => d.name === name)!;
  const shown = (name: string) => row(name).visible?.() ?? true;

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
      const notes = row("Notes");
      expect(notes.desc).toContain("3 of 5 notes");
      expect(notes.control?.options).toHaveProperty("projects");
    });

    it("puts every row under a heading, in the order a writer meets them", () => {
      const headings = defs().map((d) => d.heading);
      expect(headings).toEqual(["Where it runs", "Writing", "Lenses", "Manuscript outline", "Manuscript comments", "Manuscript page", "Stories and goals", "Model assistant"]);
      expect(defs().every((d) => d.items && d.items.length > 0)).toBe(true);
    });

    it("declares every setting with a searchable name", () => {
      const all = names(defs());
      expect(all).toEqual(expect.arrayContaining([
        "Enabled", "Notes", "Folders", "Typewriter scrolling", "Current line", "Focus fade", "Paragraph strength", "Far text strength", "Paragraph rhythm", "Rhythm tiers", "Zen Mode goes fullscreen",
        "Readability in the status bar", "Lens", "Rhythm tint underneath", "Kinds", "Bad words note", "Dialogue marks", "Thought marks", "Thought pattern", "Dim narration",
        "Model", "Analyse automatically", "Ollama URL", "Ollama model", "Claude model", "Anthropic API key", "Daily spending cap (USD)",
        "Writing log note", "Echoes on the page", "Echo sensitivity", "Stories folder", "Daily word goal",
      ]));
    });

    it("leaves the manuscript view's own switches to the view", () => {
      expect(names(defs())).not.toContain("Prose only");
      expect(names(defs())).not.toContain("Comments pane");
    });

    it("keeps every description to one line", () => {
      for (const d of flat()) if (d.desc) expect(d.desc.length, d.name).toBeLessThan(140);
    });

    it("hides a row until the row it depends on is switched on", async () => {
      expect(shown("Paragraph strength")).toBe(true);
      expect(shown("Rhythm tiers")).toBe(true);
      expect(shown("Kinds")).toBe(true);
      expect(shown("Folders")).toBe(false);
      expect(shown("Custom pattern")).toBe(false);
      expect(shown("Ollama URL")).toBe(false);
      expect(shown("Claude model")).toBe(false);
      expect(shown("Analyse automatically")).toBe(false);
      expect(shown("Pause before analysing")).toBe(false);

      await tab.setControlValue("focusFadeEnabled", false);
      await tab.setControlValue("rhythmEnabled", false);
      await tab.setControlValue("lens", "none");
      expect(shown("Paragraph strength")).toBe(false);
      expect(shown("Far text strength")).toBe(false);
      expect(shown("Rhythm tiers")).toBe(false);
      expect(shown("Kinds")).toBe(false);
      expect(shown("Rhythm tint underneath")).toBe(false);
      await tab.setControlValue("lens", "words");
      expect(shown("Kinds")).toBe(false);
      expect(shown("Rhythm tint underneath")).toBe(true);
      expect(shown("Bad words note")).toBe(true);
      expect(shown("Thought pattern")).toBe(false);
      await tab.setControlValue("dialogue.thoughts", "custom");
      expect(shown("Thought pattern")).toBe(true);

      await tab.setControlValue("scope.mode", "folders");
      expect(shown("Folders")).toBe(true);
      await tab.setControlValue("manuscript.stripPrefix", "^Draft ");
      expect(shown("Custom pattern")).toBe(true);

      await tab.setControlValue("llm.provider", "ollama");
      expect(shown("Ollama URL")).toBe(true);
      expect(shown("Claude model")).toBe(false);
      expect(shown("Analyse automatically")).toBe(true);
      expect(shown("Pause before analysing")).toBe(false);
      await tab.setControlValue("llm.onIdle", true);
      expect(shown("Pause before analysing")).toBe(true);
      await tab.setControlValue("llm.provider", "claude");
      expect(shown("Ollama URL")).toBe(false);
      expect(shown("Anthropic API key")).toBe(true);
    });

    it("re-renders when a row that others depend on changes, and only then", async () => {
      await tab.setControlValue("typewriterEnabled", false);
      expect(Setting.created).toHaveLength(0);
      await tab.setControlValue("focusFadeEnabled", false);
      expect(Setting.created.length).toBeGreaterThan(0);
    });

    it("gives the one-per-line settings a multi-line control", () => {
      expect(row("Folders").control!.type).toBe("textarea");
      expect(row("Tags").control!.type).toBe("textarea");
    });

    it("shows the style-check kinds as one row of chips", async () => {
      const kinds = row("Kinds");
      expect(kinds.render).toBeTypeOf("function");
      const setting = new Setting(document.createElement("div"));
      (kinds.render as (s: Setting) => void)(setting);
      const chips = Array.from(setting.controlEl.querySelectorAll("button.czm-chip"));
      expect(chips.map((c) => c.textContent)).toEqual(["Clichés", "Passive voice", "Filter verbs", "Adverbs", "Repetition", "Nominalisations", "Weak verbs", "Metaphor candidates"]);
      expect(chips.every((c) => c.classList.contains("is-active"))).toBe(true);
      (chips[1] as HTMLButtonElement).click();
      await Promise.resolve();
      expect(saved[0]!.styleChecks.passive).toBe(false);
      expect(saved[0]!.styleChecks.cliche).toBe(true);
      expect(chips[1]!.classList.contains("is-active")).toBe(false);
      expect(chips[1]!.getAttribute("aria-pressed")).toBe("false");
    });

    it("names the command that actually exists in the Enabled description", () => {
      const def = JSON.stringify(defs());
      expect(def).toContain("\\\"Toggle everywhere\\\"");
      expect(def).not.toContain("Toggle Creative Writer (everywhere)");
    });

    it("keeps the word list note on a usable path", async () => {
      await tab.setControlValue("words.note", "Lists/Words");
      expect(saved[0]!.words.note).toBe("Lists/Words.md");
      await tab.setControlValue("words.note", "");
      expect(saved).toHaveLength(1);
    });

    it("keeps the writing log note on a usable path and the echo sensitivity on a known level", async () => {
      await tab.setControlValue("goals.logNote", "Journal/Log");
      expect(saved[0]!.goals.logNote).toBe("Journal/Log.md");
      await tab.setControlValue("goals.logNote", "   ");
      expect(saved).toHaveLength(1);
      await tab.setControlValue("threads.echoSensitivity", "high");
      expect(saved[1]!.threads.echoSensitivity).toBe("high");
      await tab.setControlValue("threads.echoSensitivity", "loud");
      expect(saved[2]!.threads.echoSensitivity).toBe("medium");
      expect(tab.getControlValue("goals.logNote")).toBe("Journal/Log.md");
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
      expect(names(defs())).toContain("Anthropic API key");
      const def = JSON.stringify(defs());
      expect(def).toContain(".obsidian-custom/plugins/creative-writer/data.json");
      expect(def).toMatch(/PLAINTEXT/);
    });
  });

  describe("legacy renderer (Obsidian < 1.13)", () => {
    beforeEach(() => tab.renderLegacy());

    it("renders the same definitions: headings, visible rows, and the chips", () => {
      const created = Setting.created.map((s) => s.name).filter(Boolean);
      expect(created).toEqual(expect.arrayContaining(["Where it runs", "Typewriter scrolling", "Rhythm tiers", "Lenses", "Lens", "Kinds", "Model", "Writing log note"]));
      expect(created).not.toContain("Ollama URL");
      expect(created).not.toContain("Folders");
      expect(Setting.created.find((s) => s.name === "Tags")!.textarea).toBeDefined();
      expect(Setting.created.find((s) => s.name === "Kinds")!.controlEl.querySelectorAll("button.czm-chip")).toHaveLength(8);
    });

    it("seeds controls, persists changes, and re-renders when a parent row flips", async () => {
      expect(Setting.created.find((s) => s.name === "Rhythm tiers")!.slider!.value).toBe(DEFAULT_SETTINGS.rhythmTiers);
      await Setting.created.find((s) => s.name === "Typewriter scrolling")!.toggle!.onChangeCb(false);
      expect(saved[0]!.typewriterEnabled).toBe(false);
      await Setting.created.find((s) => s.name === "Model")!.dropdown!.onChangeCb("ollama");
      await Promise.resolve();
      expect(saved[1]!.llm.provider).toBe("ollama");
      expect(Setting.created.map((s) => s.name)).toContain("Ollama URL");
    });
  });

  it("display() falls back to the legacy renderer when the app has no base display()", () => {
    tab.display();
    expect(Setting.created.length).toBeGreaterThan(0);
  });
});

describe("stripPresetOf", () => {
  it("names the default, the empty pattern and anything else", () => {
    expect(stripPresetOf("^\\d+[\\s._)-]*")).toBe("numbers");
    expect(stripPresetOf("  ")).toBe("none");
    expect(stripPresetOf("^Draft ")).toBe("custom");
  });
});
