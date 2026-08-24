import { RhythmScale } from "../rhythm/RhythmScale";
import { FINDING_KINDS, type FindingKind } from "../style/Finding";
import type { ScopeMode, ScopeSettings } from "../scope/NoteScope";

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

export interface StoryMapSettings {
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
  layers: { explicit: true, internal: true, external: true },
  kinds: { character: true, location: true, item: true, faction: true, event: true, note: false, candidate: true, reference: true },
  hideIsolated: false,
  forces: DEFAULT_FORCES,
  colors: DEFAULT_STORY_COLORS,
  panelOpen: true,
};

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
}

export interface GoalSettings {
  /** Words added per day; 0 = no daily goal (any writing day counts for streaks). */
  readonly dailyWords: number;
}

export const DEFAULT_GOALS: GoalSettings = { dailyWords: 500 };

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

  const unit = (key: "focusParagraphOpacity" | "focusFarOpacity") =>
    typeof r[key] === "number" && Number.isFinite(r[key]) ? Math.min(1, Math.max(0.05, r[key] as number)) : DEFAULT_SETTINGS[key];

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
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeStoryMap(raw: unknown): StoryMapSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flags = <K extends string>(v: unknown, keys: readonly K[], defaults: Readonly<Record<K, boolean>>): Record<K, boolean> => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const out: Record<K, boolean> = { ...defaults };
    for (const k of keys) if (typeof o[k] === "boolean") out[k] = o[k] as boolean;
    return out;
  };
  const f = (r.forces && typeof r.forces === "object" ? r.forces : {}) as Record<string, unknown>;
  const force = (key: keyof ForceSettings) => {
    const [min, max] = FORCE_RANGES[key];
    const v = f[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULT_FORCES[key];
  };
  const c = (r.colors && typeof r.colors === "object" ? r.colors : {}) as Record<string, unknown>;
  const colors = { ...DEFAULT_STORY_COLORS };
  for (const k of STORY_KINDS) if (typeof c[k] === "string" && HEX.test(c[k] as string)) colors[k] = (c[k] as string).toLowerCase();
  return {
    layers: flags(r.layers, STORY_LAYERS, DEFAULT_STORY_MAP.layers),
    kinds: flags(r.kinds, STORY_KINDS, DEFAULT_STORY_MAP.kinds),
    hideIsolated: typeof r.hideIsolated === "boolean" ? r.hideIsolated : DEFAULT_STORY_MAP.hideIsolated,
    forces: { repulsion: force("repulsion"), linkDistance: force("linkDistance"), linkStrength: force("linkStrength"), gravity: force("gravity") },
    colors,
    panelOpen: typeof r.panelOpen === "boolean" ? r.panelOpen : DEFAULT_STORY_MAP.panelOpen,
  };
}

const SCOPE_MODES: readonly ScopeMode[] = ["all", "marked", "folders"];

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
  return { dailyWords };
}
