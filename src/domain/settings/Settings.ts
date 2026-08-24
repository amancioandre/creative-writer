import { RhythmScale } from "../rhythm/RhythmScale";
import { FINDING_KINDS, type FindingKind } from "../style/Finding";

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

export interface PluginSettings {
  readonly typewriterEnabled: boolean;
  readonly focusFadeEnabled: boolean;
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
}

export interface GoalSettings {
  /** Words added per day; 0 = no daily goal (any writing day counts for streaks). */
  readonly dailyWords: number;
}

export const DEFAULT_GOALS: GoalSettings = { dailyWords: 500 };

export const DEFAULT_STYLE_CHECKS: Readonly<Record<FindingKind, boolean>> = {
  cliche: true, passive: true, weak: true, filter: true, adverb: true, repetition: true,
  metaphor: true, nominalization: true, weakverb: true,
};

export const DEFAULT_SETTINGS: PluginSettings = {
  typewriterEnabled: true,
  focusFadeEnabled: true,
  rhythmEnabled: true,
  rhythmTiers: 6,
  zenFullscreen: false,
  styleEnabled: true,
  styleChecks: DEFAULT_STYLE_CHECKS,
  readabilityEnabled: true,
  goals: DEFAULT_GOALS,
  llm: DEFAULT_LLM_SETTINGS,
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

  return {
    typewriterEnabled: bool("typewriterEnabled"),
    focusFadeEnabled: bool("focusFadeEnabled"),
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
  };
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
