import { type App, type Plugin, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import { RhythmScale } from "../../domain/rhythm/RhythmScale";
import { MAX_READING_SPEED, MIN_READING_SPEED } from "../../domain/manuscript/ReadingTime";
import { DEFAULT_GOALS, DEFAULT_MANUSCRIPT, DEFAULT_WORDS, ECHO_SENSITIVITIES, foldersToText, normalizeNotePath, tagsToText, textToFolders, textToTags, type EchoSensitivity, type PluginSettings } from "../../domain/settings/Settings";
import { LENSES, LENS_LABELS, type Lens } from "../../domain/lens/Lens";
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

const ECHO_OPTIONS: Record<EchoSensitivity, string> = { low: "Low", medium: "Medium", high: "High" };

const LENS_OPTIONS: Record<Lens, string> = Object.fromEntries(LENSES.map((l) => [l, LENS_LABELS[l]])) as Record<Lens, string>;

const STRIP_PRESETS: Record<string, string> = { numbers: "Numbers and separators (01 -, 3., 2))", none: "Nothing", custom: "Custom pattern" };

/** Which preset a pattern is; anything but the default and empty is custom. */
export function stripPresetOf(pattern: string): keyof typeof STRIP_PRESETS {
  return pattern === DEFAULT_MANUSCRIPT.stripPrefix ? "numbers" : pattern.trim() === "" ? "none" : "custom";
}

/** The style-check kinds as the chips row shows them: kind, label, and the note behind the label. */
export const STYLE_CHECKS: ReadonlyArray<[FindingKind, string, string]> = [
  ["cliche", "Clichés", "Phrases worn smooth by overuse."],
  ["passive", "Passive voice", "\"The letter was written\" — by whom?"],
  ["filter", "Filter verbs", "saw, heard, felt, realised — narrating perception instead of rendering it."],
  ["adverb", "Adverbs", "-ly adverbs, especially on dialogue tags."],
  ["repetition", "Repetition", "A word echoed within thirty words, or three sentences opening alike."],
  ["nominalization", "Nominalisations", "\"made a decision\" → \"decided\"; the action hiding inside a noun."],
  ["weakverb", "Weak verbs", "A long sentence carried only by \"was\" or \"is\"."],
  ["metaphor", "Metaphor candidates", "A concrete word applied to an abstract one — possibly figurative. Fresh or tired is your call."],
];

/*
 * The tab's own vocabulary for a definition. Structurally it is what Obsidian
 * 1.13 renders from getSettingDefinitions(); the legacy renderer walks the
 * same list, so the two paths cannot drift. Local types rather than
 * Obsidian's because the test build stands the API in with a stub.
 */
type Control =
  | { type: "toggle"; key: string }
  | { type: "dropdown"; key: string; options: Record<string, string> }
  | { type: "slider"; key: string; min: number; max: number; step: number }
  | { type: "text"; key: string; placeholder?: string }
  | { type: "textarea"; key: string; placeholder?: string; rows?: number };
interface ControlRow { name: string; desc?: string; control: Control; visible?: () => boolean }
interface RenderRow { name: string; desc?: string; render: (setting: Setting) => void; visible?: () => boolean }
type Row = ControlRow | RenderRow;
interface Group { type: "group"; heading: string; items: Row[] }

/** Keys whose value decides whether other rows are shown; a change to one re-renders the tab. */
const PARENT_KEYS: ReadonlySet<string> = new Set(["scope.mode", "focusFadeEnabled", "rhythmEnabled", "lens", "dialogue.thoughts", "manuscript.stripPreset", "llm.provider", "llm.onIdle"]);

const DIALOGUE_OPTIONS: Record<string, string> = { double: "Double quotes “ ”", single: "Single quotes ‘ ’", dash: "Dash lines — travessão", none: "None" };
const THOUGHT_OPTIONS: Record<string, string> = { "italic-paragraph": "A sentence or paragraph in italics", "italic-any": "Any italics", "single-quotes": "Single quotes ‘ ’", custom: "Custom pattern", none: "None" };

/**
 * Settings are described once as definitions (Obsidian 1.13+: rendered by
 * the app and indexed for settings search) and read/written through dotted
 * keys. Older app versions fall back to the imperative renderer below, which
 * walks the same definitions.
 *
 * The layout follows the writer's day: where it runs, the editor while
 * drafting, the lenses, the manuscript page, stories and goals, the model.
 * A row that only matters while another is on is hidden until then, and
 * every description is one line; the how and the why live in the docs.
 */
export class CreativeZenSettingsTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private readonly port: SettingsPort) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return this.definitions();
  }

  private definitions(): Group[] {
    const s = () => this.port.current();
    const group = (heading: string, items: Row[]): Group => ({ type: "group", heading, items });
    const toggle = (key: string): Control => ({ type: "toggle", key });
    const dropdown = (key: string, options: Record<string, string>): Control => ({ type: "dropdown", key, options });
    const slider = (key: string, min: number, max: number, step: number): Control => ({ type: "slider", key, min, max, step });
    const text = (key: string, placeholder?: string): Control => ({ type: "text", key, placeholder });
    const textarea = (key: string, placeholder: string, rows: number): Control => ({ type: "textarea", key, placeholder, rows });
    const llmOn = () => s().llm.provider !== "off";

    return [
      group("Where it runs", [
        { name: "Enabled", desc: "Master switch. The \"Toggle everywhere\" command flips it.", control: toggle("enabled") },
        { name: "Notes", desc: `Which notes the tools, the counts and the story map take in. ${this.scopeLine()}`, control: dropdown("scope.mode", SCOPE_OPTIONS) },
        { name: "Folders", desc: "One vault-relative folder per line, e.g. storytelling/novel.", control: textarea("scope.foldersText", "storytelling", 3), visible: () => s().scope.mode === "folders" },
        { name: "Release notes", desc: "Show a short note once after an update, with a link to send feedback.", control: toggle("releaseNote.enabled") },
      ]),
      group("Writing", [
        { name: "Typewriter scrolling", desc: "Keep the line you are writing centred.", control: toggle("typewriterEnabled") },
        { name: "Current line", desc: "A faint band behind the line you are writing.", control: toggle("currentLineEnabled") },
        { name: "Focus fade", desc: "Fade lines the further they are from the cursor.", control: toggle("focusFadeEnabled") },
        { name: "Paragraph strength", desc: "How visible the rest of the cursor paragraph is (1 = no difference).", control: slider("focusParagraphOpacity", 0.1, 1, 0.05), visible: () => s().focusFadeEnabled },
        { name: "Far text strength", desc: "How visible the paragraphs furthest from the cursor are.", control: slider("focusFarOpacity", 0.05, 1, 0.05), visible: () => s().focusFadeEnabled },
        { name: "Paragraph rhythm", desc: "Tint each sentence of the paragraph by its length and weight; a margin meter in Zen Mode.", control: toggle("rhythmEnabled") },
        { name: "Rhythm tiers", desc: "Colour steps in the gradient.", control: slider("rhythmTiers", RhythmScale.MIN_TIERS, RhythmScale.MAX_TIERS, 1), visible: () => s().rhythmEnabled },
        { name: "Zen Mode goes fullscreen", desc: "Also ask the window for fullscreen.", control: toggle("zenFullscreen") },
        { name: "Readability in the status bar", desc: "The paragraph's reading ease. Click it for the whole note.", control: toggle("readabilityEnabled") },
      ]),
      group("Lenses", [
        { name: "Lens", desc: "A reading pass that colours every note one way at a time. Each lens is a command: type \"lens\" in the palette.", control: dropdown("lens", LENS_OPTIONS) },
        { name: "Rhythm tint underneath", desc: "Keep the faint sentence tint under the lens.", control: toggle("rhythmUnderLens"), visible: () => s().lens !== "none" },
        { name: "Kinds", desc: "Which style checks the lens shows. Hover a tint for the note.", render: (setting) => this.renderKindChips(setting), visible: () => s().lens === "style" },
        { name: "Bad words note", desc: "Your own overused words, one heading per category. A project note can name its own with bad-words.", control: text("words.note", DEFAULT_WORDS.note) },
        { name: "Dialogue marks", desc: "How speech is written. A project note can override with dialogue:.", control: dropdown("dialogue.marks", DIALOGUE_OPTIONS) },
        { name: "Thought marks", desc: "How thought is written. A word or two in italics inside a sentence is emphasis and never counts. Override with thoughts:.", control: dropdown("dialogue.thoughts", THOUGHT_OPTIONS) },
        { name: "Thought pattern", desc: "A regular expression; every match in a paragraph is a thought, group 1 when there is one.", control: text("dialogue.thoughtPattern", "^[_*](.+)[_*][.!?]?$"), visible: () => s().dialogue.thoughts === "custom" },
        { name: "Dim narration", desc: "Under the dialogue lens, fade everything that is not speech or thought.", control: toggle("dialogue.dimNarration") },
        { name: "Speaker colours", desc: "Tint speech by who is speaking: colour: in the character note, or the palette in cast order. Grey when nobody is sure.", control: toggle("dialogue.speakerColours") },
        { name: "Tag box opens by itself", desc: "When the cursor rests in a line nobody is sure about, the speaker box opens. Off: only by the \"Dialogue: tag the speaker\" command.", control: toggle("dialogue.autoBox"), visible: () => s().dialogue.speakerColours },
      ]),
      group("Manuscript outline", [
        { name: "Folder levels as headings", desc: "Folder levels below the project folder that become headings. 0 = no outline.", control: slider("manuscript.folderDepth", 0, 6, 1) },
        { name: "Note names as headings", desc: "A note whose first heading is already its name shows it once.", control: toggle("manuscript.noteTitles") },
        { name: "Strip from names", desc: "The sort prefix in \"01 - Camp\".", control: dropdown("manuscript.stripPreset", STRIP_PRESETS) },
        { name: "Custom pattern", desc: "A regular expression removed from the start of names.", control: text("manuscript.stripPrefix", DEFAULT_MANUSCRIPT.stripPrefix), visible: () => stripPresetOf(s().manuscript.stripPrefix) === "custom" },
        { name: "Nest the notes' own headings", desc: "A scene in a chapter in a part reads as level three.", control: toggle("manuscript.demoteHeadings") },
      ]),
      group("Manuscript comments", [
        { name: "Tint tags in the editor", desc: "Colour the word that opens a comment, %% TODO: … %%, in the editor.", control: toggle("manuscript.tintTags") },
        { name: "Tags", desc: "One per line: an uppercase word and a hex colour, e.g. CHECK #4a8fe2.", control: textarea("manuscript.tagsText", "TODO #d9a621", 4) },
      ]),
      group("Manuscript page", [
        { name: "Ruler", desc: "One segment per section, wide by words, coloured by readability.", control: toggle("manuscript.showRuler") },
        { name: "Story on the page", desc: "Cast per section and the model's contradictions. Builds the story map, so off by default.", control: toggle("manuscript.showStory") },
        { name: "Echoes on the page", desc: "Repeated phrases as marks in the gutter. Builds the story threads.", control: toggle("manuscript.showEchoes") },
        { name: "Echo sensitivity", desc: "How close two passages must be to count, here and in the story threads.", control: dropdown("threads.echoSensitivity", ECHO_OPTIONS) },
        { name: "Voices on the page", desc: "Who speaks each paragraph, a stripe in the speaker's colour; grey when nobody is sure. The hover box pins.", control: toggle("manuscript.showVoices") },
        { name: "Gauge marks on the page", desc: "At each scene's heading, its word on a graded thread's scale, the running total, and where it flips. Builds the story threads.", control: toggle("manuscript.showGauge") },
        { name: "Reading speed", desc: "Words per minute behind the reading times. Adults read prose at about 250.", control: slider("manuscript.readingSpeed", MIN_READING_SPEED, MAX_READING_SPEED, 10) },
      ]),
      group("Stories and goals", [
        { name: "Stories folder", desc: "Where the writer board keeps its stories. Empty = the vault root.", control: text("writer.storiesFolder", "storytelling") },
        { name: "Grid templates folder", desc: "Where Save as template writes, and where Start from a template looks for your own notes carrying creative-writer-template.", control: text("plotGrid.templatesFolder", "Creative Writer/Templates") },
        { name: "Daily word goal", desc: "Words added per day for the streak. 0 = any day you write counts.", control: slider("goals.dailyWords", 0, 5000, 50) },
        { name: "Writing log note", desc: "Daily counts, kept in the vault so they sync.", control: text("goals.logNote", DEFAULT_GOALS.logNote) },
      ]),
      group("Model assistant", [
        { name: "Model", desc: "A model reads the paragraph and adds what the rules cannot see. Ollama keeps everything on this machine.", control: dropdown("llm.provider", { off: "Off", ollama: "Local (Ollama)", claude: "Claude (Anthropic API)" }) },
        { name: "Ollama URL", control: text("llm.ollamaUrl", "http://localhost:11434"), visible: () => s().llm.provider === "ollama" },
        { name: "Ollama model", desc: "Any chat model you have pulled; qwen2.5:7b and llama3.1:8b follow the format well.", control: text("llm.ollamaModel", "qwen2.5:7b"), visible: () => s().llm.provider === "ollama" },
        { name: "Ollama embedding model", desc: "For the echo finder. nomic-embed-text is small and good.", control: text("llm.ollamaEmbedModel", "nomic-embed-text"), visible: () => s().llm.provider === "ollama" },
        { name: "Claude model", desc: "Opus 5 reads prose far more carefully; Haiku 4.5 is the budget option.", control: dropdown("llm.claudeModel", { "claude-opus-5": "Claude Opus 5", "claude-haiku-4-5": "Claude Haiku 4.5" }), visible: () => s().llm.provider === "claude" },
        { name: "Anthropic API key", desc: this.keyWarning(), control: text("llm.claudeApiKey", "sk-ant-…"), visible: () => s().llm.provider === "claude" },
        { name: "Daily spending cap (USD)", desc: `Claude calls stop at this; 0 = no cap. Spent today: $${s().llm.spend.usd.toFixed(3)}.`, control: slider("llm.dailyCapUsd", 0, 20, 0.5), visible: () => s().llm.provider === "claude" },
        { name: "Analyse automatically", desc: "After a pause in typing. Off: only by the \"Analyse paragraph with model\" command.", control: toggle("llm.onIdle"), visible: llmOn },
        { name: "Pause before analysing", desc: "Milliseconds of quiet before the model is called.", control: slider("llm.idleMs", 500, 10000, 250), visible: () => llmOn() && s().llm.onIdle },
      ]),
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
    await this.write(key, value);
    if (PARENT_KEYS.has(key)) this.refresh();
  }

  private async write(key: string, value: unknown): Promise<void> {
    if (key === "manuscript.stripPreset") {
      const c = this.port.current();
      const pattern = value === "numbers" ? DEFAULT_MANUSCRIPT.stripPrefix : value === "none" ? "" : stripPresetOf(c.manuscript.stripPrefix) === "custom" ? c.manuscript.stripPrefix : DEFAULT_MANUSCRIPT.stripPrefix;
      await this.port.update({ ...c, manuscript: { ...c.manuscript, stripPrefix: pattern } });
      return;
    }
    if (key === "manuscript.tagsText") {
      const c = this.port.current();
      await this.port.update({ ...c, manuscript: { ...c.manuscript, tags: textToTags(asText(value)) } });
      return;
    }
    if (key === "scope.foldersText") {
      const c = this.port.current();
      await this.port.update({ ...c, scope: { ...c.scope, folders: textToFolders(asText(value)) } });
      return;
    }
    if (key === "goals.logNote") {
      // An empty or invalid path is ignored: the log must always have somewhere to live.
      const p = normalizeNotePath(value);
      if (!p) return;
      const c = this.port.current();
      await this.port.update({ ...c, goals: { ...c.goals, logNote: p } });
      return;
    }
    if (key === "words.note") {
      const p = normalizeNotePath(value);
      if (!p) return;
      const c = this.port.current();
      await this.port.update({ ...c, words: { ...c.words, note: p } });
      return;
    }
    if (key === "threads.echoSensitivity") {
      const c = this.port.current();
      const v = ECHO_SENSITIVITIES.includes(value as EchoSensitivity) ? (value as EchoSensitivity) : "medium";
      await this.port.update({ ...c, threads: { ...c.threads, echoSensitivity: v } });
      return;
    }
    await this.port.update(setPath(this.port.current(), key.split("."), value));
  }

  /** Re-evaluates every row's visibility: the app's update() when it has one, else a full legacy render. */
  private refresh(): void {
    const update = (this as { update?: () => void }).update;
    if (typeof update === "function") update.call(this);
    else this.renderLegacy();
  }

  display(): void {
    // Obsidian ≥ 1.13 renders getSettingDefinitions(); older versions have no base display().
    const base = (PluginSettingTab.prototype as { display?: (this: PluginSettingTab) => void }).display;
    if (typeof base === "function") base.call(this);
    else this.renderLegacy();
  }

  /** Imperative rendering for Obsidian < 1.13: the same definitions, walked by hand. */
  renderLegacy(): void {
    const { containerEl } = this;
    containerEl.empty();
    for (const group of this.definitions()) {
      const rows = group.items.filter((row) => row.visible?.() ?? true);
      if (rows.length === 0) continue;
      new Setting(containerEl).setName(group.heading).setHeading();
      for (const row of rows) {
        const setting = new Setting(containerEl).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if ("render" in row) { row.render(setting); continue; }
        this.bind(setting, row.control);
      }
    }
  }

  private bind(setting: Setting, control: Control): void {
    const value = this.getControlValue(control.key);
    const set = (v: unknown) => void this.setControlValue(control.key, v);
    switch (control.type) {
      case "toggle": setting.addToggle((t) => t.setValue(value === true).onChange(set)); break;
      case "dropdown": setting.addDropdown((d) => d.addOptions(control.options).setValue(asText(value)).onChange(set)); break;
      case "slider": setting.addSlider((sl) => sl.setLimits(control.min, control.max, control.step).setValue(typeof value === "number" ? value : control.min).onChange(set)); break;
      case "text": setting.addText((t) => t.setPlaceholder(control.placeholder ?? "").setValue(asText(value)).onChange(set)); break;
      case "textarea": setting.addTextArea((t) => t.setPlaceholder(control.placeholder ?? "").setValue(asText(value)).onChange(set)); break;
    }
  }

  /** One row of chips, one per style-check kind; a chip is a button that toggles its kind. */
  private renderKindChips(setting: Setting): void {
    const wrap = setting.controlEl.createDiv({ cls: "czm-chips" });
    for (const [kind, name, desc] of STYLE_CHECKS) {
      const on = () => this.port.current().styleChecks[kind];
      const chip = wrap.createEl("button", { cls: "czm-chip", text: name, attr: { type: "button", title: desc, "aria-pressed": String(on()) } });
      chip.classList.toggle("is-active", on());
      chip.addEventListener("click", () => {
        const next = !on();
        chip.classList.toggle("is-active", next);
        chip.setAttribute("aria-pressed", String(next));
        void this.setControlValue(`styleChecks.${kind}`, next);
      });
    }
  }

  private keyWarning(): string {
    return `Stored in PLAINTEXT in ${this.port.configDir()}/plugins/creative-writer/data.json and syncs with the vault. Use a key you can revoke.`;
  }
}

/** The value of a text control, or "" when something else arrived. */
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Immutable deep set along a key path. */
function setPath<T>(obj: T, path: string[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const o = obj as unknown as Record<string, unknown>;
  return { ...o, [head!]: setPath(o[head!], rest, value) } as T;
}
