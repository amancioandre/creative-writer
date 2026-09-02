import { type App, type Plugin, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import { RhythmScale } from "../../domain/rhythm/RhythmScale";
import { DEFAULT_GOALS, DEFAULT_MANUSCRIPT, foldersToText, normalizeNotePath, tagsToText, textToFolders, textToTags, type ClaudeModelId, type LlmProvider, type PluginSettings } from "../../domain/settings/Settings";
import type { ScopeMode } from "../../domain/scope/NoteScope";
import type { FindingKind } from "../../domain/style/Finding";

/** What the tab needs from the outside world — not the whole plugin. */
export interface SettingsPort {
  current(): PluginSettings;
  update(next: PluginSettings): Promise<void>;
  /** The vault's configuration folder name (usually ".obsidian", but user-configurable). */
  configDir(): string;
  /** How many notes the scope rule currently takes in, out of the vault's Markdown notes. */
  scopeSummary(): { counted: number; total: number };
}

const SCOPE_OPTIONS: Record<ScopeMode, string> = {
  projects: "Project folders only",
  all: "Project folders and every other note",
  folders: "Project folders and these folders",
  marked: "Project folders and notes marked creative-writer: true",
};

const SCOPE_DESC = "One rule for everything: the notes the editor tools run in are the notes the daily goal, the project totals, the story map and the threads count. A declared project (writing-target or story: true in a note's front matter) is always in; the mode decides what else is. Side material — memos, research, reviews — stays out with creative-writer: false in its front matter, wherever it lives; creative-writer: true lets a note in whatever the mode. The plugin's own notes (writing log, story map, threads) are never counted.";


const STRIP_PRESETS: Record<string, string> = { numbers: "Numbers and separators (01 -, 3., 2))", none: "Nothing", custom: "Custom pattern" };

/** Which preset a pattern is; anything but the default and empty is custom. */
export function stripPresetOf(pattern: string): keyof typeof STRIP_PRESETS {
  return pattern === DEFAULT_MANUSCRIPT.stripPrefix ? "numbers" : pattern.trim() === "" ? "none" : "custom";
}

const STYLE_CHECKS: ReadonlyArray<[FindingKind, string, string]> = [
  ["cliche", "Clichés", "Phrases worn smooth by overuse."],
  ["passive", "Passive voice", "\"The letter was written\" — by whom?"],
  ["filter", "Filter verbs", "saw, heard, felt, realised — narrating perception instead of rendering it."],
  ["adverb", "Adverbs", "-ly adverbs, especially on dialogue tags."],
  ["repetition", "Repetition", "A word echoed within thirty words, or three sentences opening alike."],
  ["nominalization", "Nominalisations", "\"made a decision\" → \"decided\"; the action hiding inside a noun."],
  ["weakverb", "Weak verbs", "A long sentence carried only by \"was\" or \"is\"."],
  ["metaphor", "Metaphor candidates", "A concrete word applied to an abstract one — possibly figurative. Fresh or tired is your call."],
];

/**
 * Settings are described once as definitions (Obsidian 1.13+: rendered by
 * the app and indexed for settings search) and read/written through dotted
 * keys. Older app versions fall back to the imperative renderer below.
 */
export class CreativeZenSettingsTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private readonly port: SettingsPort) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.port.current();
    return [
      {
        type: "group",
        heading: "Where it runs",
        items: [
          { name: "Enabled", desc: "Master switch. The \"Toggle Creative Writer (everywhere)\" command flips it.", control: { type: "toggle", key: "enabled" } },
          { name: "Notes", desc: `${SCOPE_DESC} ${this.scopeLine()}`, control: { type: "dropdown", key: "scope.mode", options: SCOPE_OPTIONS } },
          { name: "Folders", desc: "One vault-relative folder per line, e.g. storytelling/novel.", control: { type: "text", key: "scope.foldersText", placeholder: "storytelling" } },
        ],
      },
      { name: "Typewriter scrolling", desc: "Keep the line you are writing vertically centred.", control: { type: "toggle", key: "typewriterEnabled" } },
      { name: "Current line", desc: "A faint band across the editor behind the line you are writing, so it stands out inside its paragraph.", control: { type: "toggle", key: "currentLineEnabled" } },
      { name: "Focus fade", desc: "Fade lines progressively the further they are from the cursor.", control: { type: "toggle", key: "focusFadeEnabled" } },
      { name: "Paragraph strength", desc: "How visible the rest of the cursor paragraph is, next to the line you are on (1 = no difference).", control: { type: "slider", key: "focusParagraphOpacity", min: 0.1, max: 1, step: 0.05 } },
      { name: "Far text strength", desc: "How visible the paragraphs furthest from the cursor are. Nearer ones sit between this and the paragraph strength.", control: { type: "slider", key: "focusFarOpacity", min: 0.05, max: 1, step: 0.05 } },
      { name: "Paragraph rhythm", desc: "Colour each sentence of the current paragraph by its length and weight.", control: { type: "toggle", key: "rhythmEnabled" } },
      { name: "Rhythm tiers", desc: "How many colour steps the rhythm gradient uses.", control: { type: "slider", key: "rhythmTiers", min: RhythmScale.MIN_TIERS, max: RhythmScale.MAX_TIERS, step: 1 } },
      { name: "Fullscreen in Zen Mode", desc: "Also request window fullscreen when Zen Mode is toggled on.", control: { type: "toggle", key: "zenFullscreen" } },
      { name: "Readability in status bar", desc: "Show the current paragraph's reading-ease and sentence-rhythm bands. Click it to open the writing desk with the whole note's profile.", control: { type: "toggle", key: "readabilityEnabled" } },
      {
        type: "group",
        heading: "Goals",
        items: [
          { name: "Daily word goal", desc: "Words added per day, in the notes the scope above takes in, for the streak and the progress bar in the writing desk. 0 = any day you write counts.", control: { type: "slider", key: "goals.dailyWords", min: 0, max: 5000, step: 50 } },
        ],
      },
      {
        type: "group",
        heading: "Manuscript",
        items: [
          { name: "Folder levels as headings", desc: "How many folder levels below the project folder become headings in the manuscript view. 0 = none: notes follow one another with no outline.", control: { type: "slider", key: "manuscript.folderDepth", min: 0, max: 6, step: 1 } },
          { name: "Note names as headings", desc: "Put each note's name above its text. A note whose first heading already is its name shows that heading once.", control: { type: "toggle", key: "manuscript.noteTitles" } },
          { name: "Strip from names", desc: "What to remove from the start of folder and note names before they become headings: the sort prefix in \"01 - Camp\".", control: { type: "dropdown", key: "manuscript.stripPreset", options: STRIP_PRESETS } },
          { name: "Custom pattern", desc: "With Custom above: a regular expression removed from the start of names.", control: { type: "text", key: "manuscript.stripPrefix", placeholder: DEFAULT_MANUSCRIPT.stripPrefix } },
          { name: "Nest the notes' own headings", desc: "Push the headings inside a note down below the outline, so a scene inside a chapter inside a part reads as level three.", control: { type: "toggle", key: "manuscript.demoteHeadings" } },
          { name: "Prose only", desc: "Show only paragraphs, headings, quotes and scene breaks: no lists, tables, code or callouts. Also toggled at the top of the view.", control: { type: "toggle", key: "manuscript.proseOnly" } },
          { name: "Comments pane", desc: "A pane beside the manuscript page: the active paragraph's %% comments %% with a box to add one, and every comment in reading order. Also toggled at the top of the view.", control: { type: "toggle", key: "manuscript.showComments" } },
          { name: "Tint tags in the editor", desc: "Colour the tag word that opens a comment, %% TODO: … %%, in the editor. Only inside comments; a TODO in dialogue is left alone.", control: { type: "toggle", key: "manuscript.tintTags" } },
          { name: "Tags", desc: "One per line: an uppercase word and a hex colour, e.g. CHECK #4a8fe2. A comment that opens with the word and a colon takes the colour, on the page and in the editor.", control: { type: "text", key: "manuscript.tagsText", placeholder: "TODO #d9a621" } },
          { name: "Ruler", desc: "A strip at the top of the manuscript page: one segment per section, wide by words, coloured by readability, marked when it changed today. Click a segment to go there.", control: { type: "toggle", key: "manuscript.showRuler" } },
          { name: "Story on the page", desc: "Who is in each section and scene, in the story map's colours, and the model's contradictions as red marks in the gutter. Builds the story map each refresh, so it is off by default.", control: { type: "toggle", key: "manuscript.showStory" } },
        ],
      },
      {
        type: "group",
        heading: "Style checks",
        items: [
          { name: "Style checks", desc: "Highlight clichés, passive voice, filter verbs, adverbs, repetition and more in the current paragraph. Hover a highlight for the note.", control: { type: "toggle", key: "styleEnabled" } },
          ...STYLE_CHECKS.map(([kind, name, desc]) => ({ name, desc, control: { type: "toggle" as const, key: `styleChecks.${kind}` } })),
        ],
      },
      {
        type: "group",
        heading: "Model assistant",
        items: [
          { name: "Model", desc: "A language model reads the current paragraph and adds findings the rules cannot see: clichés in context, tired metaphors, passives that hide an agent. Local Ollama keeps everything on this machine.", control: { type: "dropdown", key: "llm.provider", options: { off: "Off", ollama: "Local (Ollama)", claude: "Claude (Anthropic API)" } } },
          { name: "Analyse automatically", desc: "Run the model after a pause in typing. Off: only when you run the \"Analyse paragraph with model\" command.", control: { type: "toggle", key: "llm.onIdle" } },
          { name: "Pause before analysing", desc: "Milliseconds of quiet before the model is called.", control: { type: "slider", key: "llm.idleMs", min: 500, max: 10000, step: 250 } },
          { name: "Ollama URL", control: { type: "text", key: "llm.ollamaUrl", placeholder: "http://localhost:11434" } },
          { name: "Ollama model", desc: "Any chat model you have pulled. qwen2.5:7b and llama3.1:8b follow the JSON format well; reasoning models (deepseek-r1) are slower but better at the myth analysis.", control: { type: "text", key: "llm.ollamaModel", placeholder: "qwen2.5:7b" } },
          { name: "Claude model", desc: "Opus 5 ($5 / $25 per million tokens) reads prose far more carefully; Haiku 4.5 ($1 / $5) is the budget option. A paragraph costs roughly a cent on Opus with the rulebook cached.", control: { type: "dropdown", key: "llm.claudeModel", options: { "claude-opus-5": "Claude Opus 5", "claude-haiku-4-5": "Claude Haiku 4.5" } } },
          { name: "Anthropic API key", desc: this.keyWarning(), control: { type: "text", key: "llm.claudeApiKey", placeholder: "sk-ant-…" } },
          { name: "Daily spending cap (USD)", desc: `Claude calls stop when today's spend reaches this. 0 = no cap. Spent today: $${s.llm.spend.usd.toFixed(3)}.`, control: { type: "slider", key: "llm.dailyCapUsd", min: 0, max: 20, step: 0.5 } },
        ],
      },
    ];
  }

  private scopeLine(): string {
    const { counted, total } = this.port.scopeSummary();
    return `Right now: ${counted} of ${total} notes.`;
  }

  getControlValue(key: string): unknown {
    if (key === "scope.foldersText") return foldersToText(this.port.current().scope.folders);
    if (key === "manuscript.tagsText") return tagsToText(this.port.current().manuscript.tags);
    if (key === "manuscript.stripPreset") return stripPresetOf(this.port.current().manuscript.stripPrefix);
    return key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), this.port.current());
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "manuscript.stripPreset") {
      const c = this.port.current();
      const pattern = value === "numbers" ? DEFAULT_MANUSCRIPT.stripPrefix : value === "none" ? "" : stripPresetOf(c.manuscript.stripPrefix) === "custom" ? c.manuscript.stripPrefix : DEFAULT_MANUSCRIPT.stripPrefix;
      await this.port.update({ ...c, manuscript: { ...c.manuscript, stripPrefix: pattern } });
      return;
    }
    if (key === "manuscript.tagsText") {
      const c = this.port.current();
      await this.port.update({ ...c, manuscript: { ...c.manuscript, tags: textToTags(String(value ?? "")) } });
      return;
    }
    if (key === "scope.foldersText") {
      const c = this.port.current();
      await this.port.update({ ...c, scope: { ...c.scope, folders: textToFolders(String(value ?? "")) } });
      return;
    }
    await this.port.update(setPath(this.port.current(), key.split("."), value));
  }

  display(): void {
    // Obsidian ≥ 1.13 renders getSettingDefinitions(); older versions have no base display().
    const base = (PluginSettingTab.prototype as { display?: (this: PluginSettingTab) => void }).display;
    if (typeof base === "function") base.call(this);
    else this.renderLegacy();
  }

  /** Imperative rendering for Obsidian < 1.13. Same settings, same keys. */
  renderLegacy(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.port.current();
    const set = (patch: Partial<PluginSettings>) => this.port.update({ ...this.port.current(), ...patch });
    const llm = (patch: Partial<PluginSettings["llm"]>) => set({ llm: { ...this.port.current().llm, ...patch } });

    new Setting(containerEl).setName("Enabled").setDesc("Master switch.")
      .addToggle((t) => t.setValue(s.enabled).onChange((v) => set({ enabled: v })));
    new Setting(containerEl).setName("Notes").setDesc(`${SCOPE_DESC} ${this.scopeLine()}`)
      .addDropdown((d) => d.addOptions(SCOPE_OPTIONS).setValue(s.scope.mode).onChange((v) => set({ scope: { ...this.port.current().scope, mode: v as ScopeMode } })));
    new Setting(containerEl).setName("Folders").setDesc("One vault-relative folder per line.")
      .addText((t) => t.setPlaceholder("storytelling").setValue(foldersToText(s.scope.folders)).onChange((v) => set({ scope: { ...this.port.current().scope, folders: textToFolders(v) } })));
    new Setting(containerEl).setName("Typewriter scrolling").setDesc("Keep the line you are writing vertically centred.")
      .addToggle((t) => t.setValue(s.typewriterEnabled).onChange((v) => set({ typewriterEnabled: v })));
    new Setting(containerEl).setName("Current line").setDesc("A faint band across the editor behind the line you are writing, so it stands out inside its paragraph.")
      .addToggle((t) => t.setValue(s.currentLineEnabled).onChange((v) => set({ currentLineEnabled: v })));
    new Setting(containerEl).setName("Focus fade").setDesc("Fade lines progressively the further they are from the cursor.")
      .addToggle((t) => t.setValue(s.focusFadeEnabled).onChange((v) => set({ focusFadeEnabled: v })));
    new Setting(containerEl).setName("Paragraph strength").setDesc("How visible the rest of the cursor paragraph is next to the current line.")
      .addSlider((sl) => sl.setLimits(0.1, 1, 0.05).setValue(s.focusParagraphOpacity).onChange((v) => set({ focusParagraphOpacity: v })));
    new Setting(containerEl).setName("Far text strength").setDesc("How visible the paragraphs furthest from the cursor are.")
      .addSlider((sl) => sl.setLimits(0.05, 1, 0.05).setValue(s.focusFarOpacity).onChange((v) => set({ focusFarOpacity: v })));
    new Setting(containerEl).setName("Paragraph rhythm").setDesc("Colour each sentence of the current paragraph by its length and weight.")
      .addToggle((t) => t.setValue(s.rhythmEnabled).onChange((v) => set({ rhythmEnabled: v })));
    new Setting(containerEl).setName("Rhythm tiers").setDesc("How many colour steps the rhythm gradient uses.")
      .addSlider((sl) => sl.setLimits(RhythmScale.MIN_TIERS, RhythmScale.MAX_TIERS, 1).setValue(s.rhythmTiers).onChange((v) => set({ rhythmTiers: v })));
    new Setting(containerEl).setName("Fullscreen in Zen Mode").setDesc("Also request window fullscreen when Zen Mode is toggled on.")
      .addToggle((t) => t.setValue(s.zenFullscreen).onChange((v) => set({ zenFullscreen: v })));
    new Setting(containerEl).setName("Readability in status bar").setDesc("Show the current paragraph's reading-ease and sentence-rhythm bands. Click it to open the writing desk.")
      .addToggle((t) => t.setValue(s.readabilityEnabled).onChange((v) => set({ readabilityEnabled: v })));

    new Setting(containerEl).setName("Goals").setHeading();
    new Setting(containerEl).setName("Daily word goal").setDesc("Words added per day, in the notes the scope takes in, for the streak and the progress bar in the writing desk. 0 = any day you write counts.")
      .addSlider((sl) => sl.setLimits(0, 5000, 50).setValue(s.goals.dailyWords).onChange((v) => set({ goals: { ...this.port.current().goals, dailyWords: v } })));
    new Setting(containerEl).setName("Writing log note").setDesc("Vault-relative path of the note that keeps the log (words added and cut per day), so streaks sync with the vault. Takes effect at the next save; reload to read from a new path.")
      .addText((t) => t.setPlaceholder(DEFAULT_GOALS.logNote).setValue(s.goals.logNote).onChange((v) => { const p = normalizeNotePath(v); if (p) void set({ goals: { ...this.port.current().goals, logNote: p } }); }));

    new Setting(containerEl).setName("Manuscript").setHeading();
    const ms = (patch: Partial<PluginSettings["manuscript"]>) => set({ manuscript: { ...this.port.current().manuscript, ...patch } });
    new Setting(containerEl).setName("Folder levels as headings").setDesc("How many folder levels below the project folder become headings in the manuscript view. 0 = none.")
      .addSlider((sl) => sl.setLimits(0, 6, 1).setValue(s.manuscript.folderDepth).onChange((v) => ms({ folderDepth: v })));
    new Setting(containerEl).setName("Note names as headings").setDesc("Put each note's name above its text. A note whose first heading already is its name shows that heading once.")
      .addToggle((t) => t.setValue(s.manuscript.noteTitles).onChange((v) => ms({ noteTitles: v })));
    new Setting(containerEl).setName("Strip from names").setDesc("What to remove from the start of folder and note names before they become headings.")
      .addDropdown((d) => d.addOptions(STRIP_PRESETS).setValue(stripPresetOf(s.manuscript.stripPrefix)).onChange((v) => ms({ stripPrefix: v === "numbers" ? DEFAULT_MANUSCRIPT.stripPrefix : v === "none" ? "" : this.port.current().manuscript.stripPrefix })));
    new Setting(containerEl).setName("Custom pattern").setDesc("With Custom above: a regular expression removed from the start of names.")
      .addText((t) => t.setPlaceholder(DEFAULT_MANUSCRIPT.stripPrefix).setValue(s.manuscript.stripPrefix).onChange((v) => ms({ stripPrefix: v })));
    new Setting(containerEl).setName("Nest the notes' own headings").setDesc("Push the headings inside a note down below the outline.")
      .addToggle((t) => t.setValue(s.manuscript.demoteHeadings).onChange((v) => ms({ demoteHeadings: v })));
    new Setting(containerEl).setName("Prose only").setDesc("Show only paragraphs, headings, quotes and scene breaks. Also toggled at the top of the view.")
      .addToggle((t) => t.setValue(s.manuscript.proseOnly).onChange((v) => ms({ proseOnly: v })));
    new Setting(containerEl).setName("Comments pane").setDesc("A pane beside the manuscript page: the active paragraph's comments with a box to add one, and every comment in reading order.")
      .addToggle((t) => t.setValue(s.manuscript.showComments).onChange((v) => ms({ showComments: v })));
    new Setting(containerEl).setName("Tint tags in the editor").setDesc("Colour the tag word that opens a comment, %% TODO: … %%, in the editor.")
      .addToggle((t) => t.setValue(s.manuscript.tintTags).onChange((v) => ms({ tintTags: v })));
    new Setting(containerEl).setName("Tags").setDesc("One per line: an uppercase word and a hex colour, e.g. CHECK #4a8fe2.")
      .addText((t) => t.setPlaceholder("TODO #d9a621").setValue(tagsToText(s.manuscript.tags)).onChange((v) => ms({ tags: textToTags(v) })));
    new Setting(containerEl).setName("Ruler").setDesc("A strip at the top of the manuscript page: one segment per section, wide by words, coloured by readability.")
      .addToggle((t) => t.setValue(s.manuscript.showRuler).onChange((v) => ms({ showRuler: v })));
    new Setting(containerEl).setName("Story on the page").setDesc("Who is in each section and scene, and the model's contradictions in the gutter. Builds the story map each refresh.")
      .addToggle((t) => t.setValue(s.manuscript.showStory).onChange((v) => ms({ showStory: v })));

    new Setting(containerEl).setName("Style checks").setHeading();
    new Setting(containerEl).setName("Style checks").setDesc("Highlight clichés, passive voice, filter verbs, adverbs, repetition and more in the current paragraph. Hover a highlight for the note.")
      .addToggle((t) => t.setValue(s.styleEnabled).onChange((v) => set({ styleEnabled: v })));
    for (const [kind, name, desc] of STYLE_CHECKS) {
      new Setting(containerEl).setName(name).setDesc(desc)
        .addToggle((t) => t.setValue(s.styleChecks[kind]).onChange((v) => set({ styleChecks: { ...this.port.current().styleChecks, [kind]: v } })));
    }

    new Setting(containerEl).setName("Model assistant").setHeading();
    new Setting(containerEl).setName("Model").setDesc("A language model reads the current paragraph and adds findings the rules cannot see. Local Ollama keeps everything on this machine.")
      .addDropdown((d) => d.addOptions({ off: "Off", ollama: "Local (Ollama)", claude: "Claude (Anthropic API)" }).setValue(s.llm.provider).onChange((v) => llm({ provider: v as LlmProvider })));
    new Setting(containerEl).setName("Analyse automatically").setDesc("Run the model after a pause in typing. Off: only on command.")
      .addToggle((t) => t.setValue(s.llm.onIdle).onChange((v) => llm({ onIdle: v })));
    new Setting(containerEl).setName("Pause before analysing").setDesc("Milliseconds of quiet before the model is called.")
      .addSlider((sl) => sl.setLimits(500, 10000, 250).setValue(s.llm.idleMs).onChange((v) => llm({ idleMs: v })));
    new Setting(containerEl).setName("Ollama URL")
      .addText((t) => t.setPlaceholder("http://localhost:11434").setValue(s.llm.ollamaUrl).onChange((v) => llm({ ollamaUrl: v })));
    new Setting(containerEl).setName("Ollama model").setDesc("Any chat model you have pulled.")
      .addText((t) => t.setPlaceholder("qwen2.5:7b").setValue(s.llm.ollamaModel).onChange((v) => llm({ ollamaModel: v })));
    new Setting(containerEl).setName("Claude model")
      .addDropdown((d) => d.addOptions({ "claude-opus-5": "Claude Opus 5", "claude-haiku-4-5": "Claude Haiku 4.5" }).setValue(s.llm.claudeModel).onChange((v) => llm({ claudeModel: v as ClaudeModelId })));
    new Setting(containerEl).setName("Anthropic API key").setDesc(this.keyWarning())
      .addText((t) => t.setPlaceholder("sk-ant-…").setValue(s.llm.claudeApiKey).onChange((v) => llm({ claudeApiKey: v })));
    new Setting(containerEl).setName("Daily spending cap (USD)").setDesc(`Claude calls stop when today's spend reaches this. 0 = no cap. Spent today: $${s.llm.spend.usd.toFixed(3)}.`)
      .addSlider((sl) => sl.setLimits(0, 20, 0.5).setValue(s.llm.dailyCapUsd).onChange((v) => llm({ dailyCapUsd: v })));
  }

  private keyWarning(): string {
    return `Stored in PLAINTEXT in this vault's ${this.port.configDir()}/plugins/creative-writer/data.json. If the vault syncs, the key syncs with it. Use a key you can revoke.`;
  }
}

/** Immutable deep set along a key path. */
function setPath<T>(obj: T, path: string[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const o = obj as unknown as Record<string, unknown>;
  return { ...o, [head!]: setPath(o[head!], rest, value) } as T;
}
