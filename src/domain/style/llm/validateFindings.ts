import { Finding, FINDING_KINDS, type FindingKind } from "../Finding";
import { locate, normalise } from "../../text/LocateQuote";

export { quoteAppears } from "../../text/LocateQuote";

/** What a model is asked to return per finding. Offsets are optional hints; the quote is authoritative. */
export interface RawFinding {
  readonly kind: FindingKind;
  readonly quote: string;
  readonly note: string;
  readonly start?: number;
  readonly end?: number;
}

const MAX_NOTE = 400;
const KINDS = new Set<string>(FINDING_KINDS);

/**
 * Turns model output into trustworthy findings. Models are bad at character
 * arithmetic and good at quoting, so each finding is anchored by locating
 * its quote in the text (loosely: case, curly quotes and whitespace are
 * normalised). Anything that cannot be anchored is dropped rather than
 * rendered in the wrong place.
 */
export function validateFindings(raw: readonly unknown[], text: string): Finding[] {
  const norm = normalise(text);
  const out: Finding[] = [];
  for (const r of raw) {
    const f = coerce(r);
    if (!f) continue;
    const span = locate(norm, normalise(f.quote).text, f.start);
    if (!span) continue;
    const [from, to] = span;
    if (out.some((o) => o.kind === f.kind && from < o.to && to > o.from)) continue;
    out.push(Finding.create(f.kind, from, to, f.note));
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

function coerce(r: unknown): RawFinding | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.kind !== "string" || !KINDS.has(o.kind)) return null;
  if (typeof o.quote !== "string" || o.quote.trim().length === 0) return null;
  if (typeof o.note !== "string" || o.note.trim().length === 0) return null;
  return {
    kind: o.kind as FindingKind,
    quote: o.quote,
    note: o.note.trim().slice(0, MAX_NOTE),
    start: typeof o.start === "number" ? o.start : undefined,
    end: typeof o.end === "number" ? o.end : undefined,
  };
}
