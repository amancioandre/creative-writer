import { RhythmScale } from "../rhythm/RhythmScale";
import { FINDING_KINDS, type FindingKind } from "../style/Finding";
import type { ScopeMode, ScopeSettings } from "../scope/NoteScope";
import { DEFAULT_STRIP_PREFIX, type ManuscriptOptions } from "../manuscript/Manuscript";
import { DEFAULT_TAGS, type TagSpec } from "../manuscript/Comments";

export type LlmProvider = "off" | "ollama" | "claude";
export type ClaudeModelId = "claude-opus-5" | "claude-haiku-4-5";

export interface LlmSettings {
  readonly provider: LlmProvider;
  /** Analyse the cursor paragraph automatically after a pause in typing. Otherwise only on command. */
  readonly onIdle: boolean;
  readonly idleMs: number;
  readonly ollamaUrl: string;
  readonly ollamaModel: string;
  readonly claudeModel: ClaudeModelId;
  /** Stored in plaintext in data.json inside the vault. The settings tab says so. */
  readonly claudeApiKey: string;
  /** USD per local day; 0 = unlimited. */
  readonly dailyCapUsd: number;
  readonly spend: { readonly day: string; readonly usd: number };
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: "off",
  onIdle: false,
  idleMs: 1500,
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5:7b",
  claudeModel: "claude-opus-5",
  claudeApiKey: "",
  dailyCapUsd: 1,
  spend: { day: "", usd: 0 },
};

export type StoryEntityKind = "character" | "location" | "item" | "faction" | "event" | "note" | "candidate" | "reference";
export type StoryLayer = "explicit" | "internal" | "external";

export interface ForceSettings {
  /** How hard nodes push each other apart. */
  readonly repulsion: number;
  /** Resting length of an edge, in graph units. */
  readonly linkDistance: number;
  /** How strongly edges pull toward that length. */
  readonly linkStrength: number;
  /** Pull toward the centre; keeps islands from drifting off. */
  readonly gravity: number;
}

export interface DisplaySettings {
  /** Multiplier on node radius. */
  readonly nodeSize: number;
  /** Multiplier on edge stroke width. */
  readonly edgeWidth: number;
  /** Base opacity of edges, 0.1–1. */
  readonly edgeOpacity: number;
  /** Label font size in px; 0 hides labels. */
  readonly labelSize: number;
}

export const DEFAULT_DISPLAY: DisplaySettings = { nodeSize: 1, edgeWidth: 1, edgeOpacity: 0.55, labelSize: 11 };
export const DISPLAY_RANGES: Readonly<Record<keyof DisplaySettings, readonly [number, number, number]>> = {
  nodeSize: [0.4, 2.5, 0.1],
  edgeWidth: [0.3, 3, 0.1],
  edgeOpacity: [0.1, 1, 0.05],
  labelSize: [0, 18, 1],
};

export interface StoryMapSettings {
  readonly display: DisplaySettings;
  readonly layers: Readonly<Record<StoryLayer, boolean>>;
  readonly kinds: Readonly<Record<StoryEntityKind, boolean>>;
  readonly hideIsolated: boolean;
  readonly forces: ForceSettings;
  /** Hex colour per node kind. */
  readonly colors: Readonly<Record<StoryEntityKind, string>>;
  readonly panelOpen: boolean;
}

export const STORY_KINDS: readonly StoryEntityKind[] = ["character", "location", "item", "faction", "event", "note", "candidate", "reference"];
export const STORY_LAYERS: readonly StoryLayer[] = ["explicit", "internal", "external"];

export const DEFAULT_FORCES: ForceSettings = { repulsion: 1, linkDistance: 90, linkStrength: 0.5, gravity: 0.1 };
export const FORCE_RANGES: Readonly<Record<keyof ForceSettings, readonly [number, number, number]>> = {
  repulsion: [0.1, 4, 0.1],
  linkDistance: [30, 300, 5],
  linkStrength: [0.05, 1, 0.05],
  gravity: [0, 0.5, 0.01],
};

export const DEFAULT_STORY_COLORS: Readonly<Record<StoryEntityKind, string>> = {
  character: "#4a8fe2", location: "#3fa66b", item: "#d9a621", faction: "#e07b39", event: "#d64545",
  note: "#8a8a8a", candidate: "#9a9a9a", reference: "#8e5bd6",
};

export const DEFAULT_STORY_MAP: StoryMapSettings = {
  display: DEFAULT_DISPLAY,
  layers: { explicit: true, internal: true, external: true },
  kinds: { character: true, location: true, item: true, faction: true, event: true, note: false, candidate: true, reference: true },
  hideIsolated: false,
  forces: DEFAULT_FORCES,
  colors: DEFAULT_STORY_COLORS,
  panelOpen: true,
};

export type ThreadKind = "entity" | "fact" | "writer";
export const THREAD_KINDS: readonly ThreadKind[] = ["entity", "fact", "writer"];

/** The story threads view's own preferences — filters and strips, edited from its panel. */
export interface ThreadsSettings {
  readonly kinds: Readonly<Record<ThreadKind, boolean>>;
  /** Strip id → shown; strips not listed are shown. */
  readonly strips: Readonly<Record<string, boolean>>;
  readonly showDismissed: boolean;
  readonly contradictionsOnly: boolean;
  readonly panelOpen: boolean;
}

/** Entity threads are the densest and the least surprising, so they start off; a picked entity turns its own on. */
export const DEFAULT_THREADS: ThreadsSettings = {
  kinds: { entity: false, fact: true, writer: true },
  strips: {},
  showDismissed: false,
  contradictionsOnly: false,
  panelOpen: true,
};

/**
 * How the manuscript view stitches a project — the outline it draws from
 * folders and note names, what it leaves out — and the comment layer: whether
 * `%% comments %%` show on the page, which tags colour them, and whether the
 * tag word is tinted in the editor too.
 */
export interface ManuscriptSettings extends ManuscriptOptions {
  readonly showComments: boolean;
  readonly tintTags: boolean;
  readonly tags: readonly TagSpec[];
  /** The strip at the top: one segment per section, width by words, coloured by readability. */
  readonly showRuler: boolean;
  /** The story on the page: who is in each section and scene, and the model's contradictions in the gutter. Costs a map build. */
  readonly showStory: boolean;
}

export const DEFAULT_MANUSCRIPT: ManuscriptSettings = {
  folderDepth: 2, noteTitles: true, stripPrefix: DEFAULT_STRIP_PREFIX, demoteHeadings: true, proseOnly: false,
  showComments: true, tintTags: true, tags: DEFAULT_TAGS, showRuler: true, showStory: false,
};

export function normalizeManuscript(raw: unknown): ManuscriptSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (key: "noteTitles" | "demoteHeadings" | "proseOnly" | "showComments" | "tintTags" | "showRuler" | "showStory") => (typeof r[key] === "boolean" ? (r[key] as boolean) : DEFAULT_MANUSCRIPT[key]);
  return {
    folderDepth: typeof r.folderDepth === "number" && Number.isFinite(r.folderDepth) ? clampInt(r.folderDepth, 0, 6) : DEFAULT_MANUSCRIPT.folderDepth,
    noteTitles: bool("noteTitles"),
    stripPrefix: typeof r.stripPrefix === "string" ? r.stripPrefix : DEFAULT_MANUSCRIPT.stripPrefix,
    demoteHeadings: bool("demoteHeadings"),
    proseOnly: bool("proseOnly"),
    showComments: bool("showComments"),
    tintTags: bool("tintTags"),
    tags: Array.isArray(r.tags) ? normalizeTags(r.tags) : DEFAULT_MANUSCRIPT.tags,
    showRuler: bool("showRuler"),
    showStory: bool("showStory"),
  };
}

const TAG_NAME = /^[A-Z][A-Z0-9_-]{1,15}$/;

/** Known shape only: an uppercase name and a hex colour; the rest is dropped, duplicates keep their first colour. */
export function normalizeTags(raw: readonly unknown[]): TagSpec[] {
  const out: TagSpec[] = [];
  for (const item of raw) {
    const t = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name.trim().toUpperCase() : "";
    if (!TAG_NAME.test(name) || out.some((o) => o.name === name)) continue;
    out.push({ name, color: typeof t.color === "string" && HEX.test(t.color) ? t.color.toLowerCase() : "#8a8a8a" });
  }
  return out;
}

/** Tags as the settings box shows them: one per line, `NAME #rrggbb`. */
export function tagsToText(tags: readonly TagSpec[]): string {
  return tags.map((t) => `${t.name} ${t.color}`).join("\n");
}
export function textToTags(text: string): TagSpec[] {
  return normalizeTags(text.split(/[\n,]/).map((line) => { const [name, color] = line.trim().split(/\s+/); return { name, color }; }));
}

export interface PluginSettings {
  /** Master switch; the "Toggle Creative Writer" command flips it. */
  readonly enabled: boolean;
  /** Which notes the plugin runs in; front matter `creative-writer:` overrides. */
  readonly scope: ScopeSettings;
  readonly typewriterEnabled: boolean;
  /** Faint full-width band behind the cursor's visual line. */
  readonly currentLineEnabled: boolean;
  readonly focusFadeEnabled: boolean;
  /** Opacity of the cursor paragraph's other rows (the cursor row is always 1). */
  readonly focusParagraphOpacity: number;
  /** Opacity of the paragraphs furthest from the cursor; nearer rings sit between this and the paragraph value. */
  readonly focusFarOpacity: number;
  readonly rhythmEnabled: boolean;
  readonly rhythmTiers: number;
  /** Request browser fullscreen when entering Zen Mode. */
  readonly zenFullscreen: boolean;
  readonly styleEnabled: boolean;
  readonly styleChecks: Readonly<Record<FindingKind, boolean>>;
  /** Show the cursor paragraph's readability bands in the status bar. */
  readonly readabilityEnabled: boolean;
  readonly goals: GoalSettings;
  readonly llm: LlmSettings;
  readonly storyMap: StoryMapSettings;
  readonly threads: ThreadsSettings;
  readonly manuscript: ManuscriptSettings;
}

export interface GoalSettings {
  /** Words added per day; 0 = no daily goal (any writing day counts for streaks). */
  readonly dailyWords: number;
  /** Vault-relative path of the note that holds the writing log, so it syncs. */
  readonly logNote: string;
}

export const DEFAULT_GOALS: GoalSettings = { dailyWords: 500, logNote: "Creative Writer/Writing log.md" };

export const DEFAULT_STYLE_CHECKS: Readonly<Record<FindingKind, boolean>> = {
  cliche: true, passive: true, filter: true, adverb: true, repetition: true,
  metaphor: true, nominalization: true, weakverb: true,
};

export const DEFAULT_SCOPE: ScopeSettings = { mode: "all", folders: [] };

export const DEFAULT_SETTINGS: PluginSettings = {
  enabled: true,
  scope: DEFAULT_SCOPE,
  typewriterEnabled: true,
  currentLineEnabled: true,
  focusFadeEnabled: true,
  focusParagraphOpacity: 0.7,
  focusFarOpacity: 0.25,
  rhythmEnabled: true,
  rhythmTiers: 6,
  zenFullscreen: false,
  styleEnabled: true,
  styleChecks: DEFAULT_STYLE_CHECKS,
  readabilityEnabled: true,
  goals: DEFAULT_GOALS,
  llm: DEFAULT_LLM_SETTINGS,
  storyMap: DEFAULT_STORY_MAP,
  threads: DEFAULT_THREADS,
  manuscript: DEFAULT_MANUSCRIPT,
};

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(v)));

/**
 * Turns whatever was persisted (possibly from an older version, possibly
 * hand-edited) into a valid settings object. Unknown keys are dropped,
 * wrong types fall back to defaults, numbers are clamped.
 */
export function normalizeSettings(raw: unknown): PluginSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (key: keyof PluginSettings) =>
    typeof r[key] === "boolean" ? r[key] : (DEFAULT_SETTINGS[key] as boolean);

  const unit = (key: "focusParagraphOpacity" | "focusFarOpacity") => {
    const v = r[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0.05, v)) : DEFAULT_SETTINGS[key];
  };

  return {
    enabled: bool("enabled"),
    scope: normalizeScope(r.scope),
    typewriterEnabled: bool("typewriterEnabled"),
    currentLineEnabled: bool("currentLineEnabled"),
    focusFadeEnabled: bool("focusFadeEnabled"),
    focusParagraphOpacity: unit("focusParagraphOpacity"),
    focusFarOpacity: unit("focusFarOpacity"),
    rhythmEnabled: bool("rhythmEnabled"),
    rhythmTiers:
      typeof r.rhythmTiers === "number" && Number.isFinite(r.rhythmTiers)
        ? clampInt(r.rhythmTiers, RhythmScale.MIN_TIERS, RhythmScale.MAX_TIERS)
        : DEFAULT_SETTINGS.rhythmTiers,
    zenFullscreen: bool("zenFullscreen"),
    styleEnabled: bool("styleEnabled"),
    styleChecks: normalizeChecks(r.styleChecks),
    readabilityEnabled: bool("readabilityEnabled"),
    goals: normalizeGoals(r.goals),
    llm: normalizeLlm(r.llm),
    storyMap: normalizeStoryMap(r.storyMap),
    threads: normalizeThreads(r.threads),
    manuscript: normalizeManuscript(r.manuscript),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Known boolean keys from a persisted object, defaults for the rest. */
const flags = <K extends string>(v: unknown, keys: readonly K[], defaults: Readonly<Record<K, boolean>>): Record<K, boolean> => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Record<K, boolean> = { ...defaults };
  for (const k of keys) { const v = o[k]; if (typeof v === "boolean") out[k] = v; }
  return out;
};

export function normalizeThreads(raw: unknown): ThreadsSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strips: Record<string, boolean> = {};
  const s = (r.strips && typeof r.strips === "object" ? r.strips : {}) as Record<string, unknown>;
  for (const [id, v] of Object.entries(s)) if (typeof v === "boolean" && id) strips[id] = v;
  return {
    kinds: flags(r.kinds, THREAD_KINDS, DEFAULT_THREADS.kinds),
    strips,
    showDismissed: typeof r.showDismissed === "boolean" ? r.showDismissed : DEFAULT_THREADS.showDismissed,
    contradictionsOnly: typeof r.contradictionsOnly === "boolean" ? r.contradictionsOnly : DEFAULT_THREADS.contradictionsOnly,
    panelOpen: typeof r.panelOpen === "boolean" ? r.panelOpen : DEFAULT_THREADS.panelOpen,
  };
}

export function normalizeStoryMap(raw: unknown): StoryMapSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = (r.forces && typeof r.forces === "object" ? r.forces : {}) as Record<string, unknown>;
  const force = (key: keyof ForceSettings) => {
    const [min, max] = FORCE_RANGES[key];
    const v = f[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULT_FORCES[key];
  };
  const d = (r.display && typeof r.display === "object" ? r.display : {}) as Record<string, unknown>;
  const display = (key: keyof DisplaySettings) => {
    const [min, max] = DISPLAY_RANGES[key];
    const v = d[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULT_DISPLAY[key];
  };
  const c = (r.colors && typeof r.colors === "object" ? r.colors : {}) as Record<string, unknown>;
  const colors = { ...DEFAULT_STORY_COLORS };
  for (const k of STORY_KINDS) { const v = c[k]; if (typeof v === "string" && HEX.test(v)) colors[k] = v.toLowerCase(); }
  return {
    display: { nodeSize: display("nodeSize"), edgeWidth: display("edgeWidth"), edgeOpacity: display("edgeOpacity"), labelSize: display("labelSize") },
    layers: flags(r.layers, STORY_LAYERS, DEFAULT_STORY_MAP.layers),
    kinds: flags(r.kinds, STORY_KINDS, DEFAULT_STORY_MAP.kinds),
    hideIsolated: typeof r.hideIsolated === "boolean" ? r.hideIsolated : DEFAULT_STORY_MAP.hideIsolated,
    forces: { repulsion: force("repulsion"), linkDistance: force("linkDistance"), linkStrength: force("linkStrength"), gravity: force("gravity") },
    colors,
    panelOpen: typeof r.panelOpen === "boolean" ? r.panelOpen : DEFAULT_STORY_MAP.panelOpen,
  };
}

const SCOPE_MODES: readonly ScopeMode[] = ["all", "marked", "folders", "projects"];

function normalizeScope(raw: unknown): ScopeSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = SCOPE_MODES.includes(r.mode as ScopeMode) ? (r.mode as ScopeMode) : DEFAULT_SCOPE.mode;
  const folders = Array.isArray(r.folders) ? r.folders.filter((f): f is string => typeof f === "string").map((f) => f.trim()).filter(Boolean) : [];
  return { mode, folders };
}

/** Folder list as the settings text box shows it: one per line. */
export function foldersToText(folders: readonly string[]): string {
  return folders.join("\n");
}
export function textToFolders(text: string): string[] {
  return text.split(/[\n,]/).map((f) => f.trim()).filter(Boolean);
}

function normalizeChecks(raw: unknown): Record<FindingKind, boolean> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_STYLE_CHECKS };
  for (const kind of FINDING_KINDS) {
    if (typeof r[kind] === "boolean") out[kind] = r[kind];
  }
  return out;
}

/** The set of kinds currently switched on — what the style use case consumes. */
export function enabledStyleKinds(s: PluginSettings): Set<FindingKind> {
  return new Set(FINDING_KINDS.filter((k) => s.styleEnabled && s.styleChecks[k]));
}

const PROVIDERS: readonly LlmProvider[] = ["off", "ollama", "claude"];
const CLAUDE_MODELS: readonly ClaudeModelId[] = ["claude-opus-5", "claude-haiku-4-5"];

function normalizeLlm(raw: unknown): LlmSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (key: keyof LlmSettings): string => {
    const v = r[key];
    return typeof v === "string" && v.trim() ? v.trim() : (DEFAULT_LLM_SETTINGS[key] as string);
  };
  return {
    provider: PROVIDERS.includes(r.provider as LlmProvider) ? (r.provider as LlmProvider) : DEFAULT_LLM_SETTINGS.provider,
    onIdle: typeof r.onIdle === "boolean" ? r.onIdle : DEFAULT_LLM_SETTINGS.onIdle,
    idleMs: typeof r.idleMs === "number" && Number.isFinite(r.idleMs) ? clampInt(r.idleMs, 500, 10000) : DEFAULT_LLM_SETTINGS.idleMs,
    ollamaUrl: str("ollamaUrl"),
    ollamaModel: str("ollamaModel"),
    claudeModel: CLAUDE_MODELS.includes(r.claudeModel as ClaudeModelId) ? (r.claudeModel as ClaudeModelId) : DEFAULT_LLM_SETTINGS.claudeModel,
    claudeApiKey: typeof r.claudeApiKey === "string" ? r.claudeApiKey.trim() : "",
    dailyCapUsd: typeof r.dailyCapUsd === "number" && Number.isFinite(r.dailyCapUsd) ? Math.min(100, Math.max(0, r.dailyCapUsd)) : DEFAULT_LLM_SETTINGS.dailyCapUsd,
    spend: normalizeSpend(r.spend),
  };
}

function normalizeSpend(raw: unknown): { day: string; usd: number } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { day: typeof r.day === "string" ? r.day : "", usd: typeof r.usd === "number" && Number.isFinite(r.usd) && r.usd >= 0 ? r.usd : 0 };
}

/** True when the two configurations would talk to a different model. */
export function llmConfigEquals(a: LlmSettings, b: LlmSettings): boolean {
  return a.provider === b.provider && a.ollamaUrl === b.ollamaUrl && a.ollamaModel === b.ollamaModel && a.claudeModel === b.claudeModel && a.claudeApiKey === b.claudeApiKey;
}

function normalizeGoals(raw: unknown): GoalSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dailyWords = typeof r.dailyWords === "number" && Number.isFinite(r.dailyWords) ? clampInt(r.dailyWords, 0, 50_000) : DEFAULT_GOALS.dailyWords;
  const logNote = normalizeNotePath(r.logNote) ?? DEFAULT_GOALS.logNote;
  return { dailyWords, logNote };
}

/** A vault-relative markdown path: trimmed, forward slashes, no leading slash, `.md` appended if missing; null when unusable. */
export function normalizeNotePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!p || p.endsWith("/")) return null;
  if (!/\.md$/i.test(p)) p += ".md";
  return p;
}
