import { RhythmScale } from "../rhythm/RhythmScale";
import { FINDING_KINDS, type FindingKind } from "../style/Finding";

export type LlmProvider = "off" | "ollama";

export interface LlmSettings {
  readonly provider: LlmProvider;
  /** Analyse the cursor paragraph automatically after a pause in typing. Otherwise only on command. */
  readonly onIdle: boolean;
  readonly idleMs: number;
  readonly ollamaUrl: string;
  readonly ollamaModel: string;
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: "off",
  onIdle: false,
  idleMs: 1500,
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5:7b",
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
  readonly llm: LlmSettings;
}

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
    typeof r[key] === "boolean" ? (r[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean);

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
    llm: normalizeLlm(r.llm),
  };
}

function normalizeChecks(raw: unknown): Record<FindingKind, boolean> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_STYLE_CHECKS };
  for (const kind of FINDING_KINDS) {
    if (typeof r[kind] === "boolean") out[kind] = r[kind] as boolean;
  }
  return out;
}

/** The set of kinds currently switched on — what the style use case consumes. */
export function enabledStyleKinds(s: PluginSettings): Set<FindingKind> {
  return new Set(FINDING_KINDS.filter((k) => s.styleEnabled && s.styleChecks[k]));
}

const PROVIDERS: readonly LlmProvider[] = ["off", "ollama"];

function normalizeLlm(raw: unknown): LlmSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (key: keyof LlmSettings) => (typeof r[key] === "string" && (r[key] as string).trim() ? (r[key] as string).trim() : (DEFAULT_LLM_SETTINGS[key] as string));
  return {
    provider: PROVIDERS.includes(r.provider as LlmProvider) ? (r.provider as LlmProvider) : DEFAULT_LLM_SETTINGS.provider,
    onIdle: typeof r.onIdle === "boolean" ? r.onIdle : DEFAULT_LLM_SETTINGS.onIdle,
    idleMs: typeof r.idleMs === "number" && Number.isFinite(r.idleMs) ? clampInt(r.idleMs, 500, 10000) : DEFAULT_LLM_SETTINGS.idleMs,
    ollamaUrl: str("ollamaUrl"),
    ollamaModel: str("ollamaModel"),
  };
}

/** True when the two configurations would talk to a different model. */
export function llmConfigEquals(a: LlmSettings, b: LlmSettings): boolean {
  return a.provider === b.provider && a.ollamaUrl === b.ollamaUrl && a.ollamaModel === b.ollamaModel;
}
