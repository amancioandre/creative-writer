import { RhythmScale } from "../rhythm/RhythmScale";

export interface PluginSettings {
  readonly typewriterEnabled: boolean;
  readonly focusFadeEnabled: boolean;
  readonly rhythmEnabled: boolean;
  readonly rhythmTiers: number;
  /** Request browser fullscreen when entering Zen Mode. */
  readonly zenFullscreen: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  typewriterEnabled: true,
  focusFadeEnabled: true,
  rhythmEnabled: true,
  rhythmTiers: 6,
  zenFullscreen: false,
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
  };
}
