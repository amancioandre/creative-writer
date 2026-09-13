/**
 * Whether a contradiction is a planned reversal is a judgement, and
 * judgement is where a model earns its place. But the map it judges on
 * is deterministic (the contradiction was found by code), and the
 * judgement is only ever a proposal: the writer accepts it with a
 * click, which writes the directed thread; nothing is explained or
 * dismissed on the model's say-so.
 */
export type IntentVerdict = "reversal" | "error" | "same";
export const INTENT_VERDICTS: readonly IntentVerdict[] = ["reversal", "error", "same"];

/** The model's reading of one contradiction, kept by the contradiction's key in `Story map.md`. */
export interface IntentReading {
  /** `contradictionKey(...)` — stable across re-reads and reorderings. */
  readonly key: string;
  readonly verdict: IntentVerdict;
  readonly reason: string;
  /** 0..1 */
  readonly confidence: number;
  readonly model: string;
  readonly rulebook: string;
}

const MAX_REASON = 240;

/** The verdict from the enum only, the reason capped, the confidence clamped; anything else is dropped. Same discipline as `validateFacts`. */
export function validateIntent(raw: unknown): Pick<IntentReading, "verdict" | "reason" | "confidence"> | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const verdict = typeof o.verdict === "string" ? o.verdict.trim().toLowerCase() : "";
  if (!INTENT_VERDICTS.includes(verdict as IntentVerdict)) return null;
  const reason = typeof o.reason === "string" ? o.reason.replace(/\s+/g, " ").trim().slice(0, MAX_REASON) : "";
  const c = typeof o.confidence === "number" && Number.isFinite(o.confidence) ? o.confidence : 0.5;
  return { verdict: verdict as IntentVerdict, reason, confidence: Math.round(Math.min(1, Math.max(0, c > 1 ? c / 100 : c)) * 100) / 100 };
}

/** One line for the card. */
export function intentLine(r: Pick<IntentReading, "verdict" | "reason" | "confidence">): string {
  const head = r.verdict === "reversal" ? "The model reads this as a reversal" : r.verdict === "error" ? "The model reads this as an error" : "The model reads these as the same thing";
  const pct = Math.round(r.confidence * 100);
  return `${head}${r.reason ? `: ${r.reason}` : ""} (${pct}%)`;
}
