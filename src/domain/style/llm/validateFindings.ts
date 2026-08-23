import { Finding, FINDING_KINDS, type FindingKind } from "../Finding";

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

interface Normalised {
  readonly text: string;
  /** normalised index → original index */
  readonly map: number[];
}

/** Lowercase, straighten quotes, collapse whitespace — keeping a map back to original offsets. */
function normalise(s: string): Normalised {
  let text = "";
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < s.length; i++) {
    let ch = s[i]!.toLowerCase();
    if (ch === "‘" || ch === "’") ch = "'";
    else if (ch === "“" || ch === "”") ch = '"';
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = " ";
      lastSpace = true;
    } else {
      lastSpace = false;
    }
    text += ch;
    map.push(i);
  }
  if (text.endsWith(" ")) {
    map.pop();
  }
  return { text: text.trimEnd(), map };
}

/** Find `needle` in the normalised haystack; prefer the occurrence nearest `hint` (an original-offset guess). */
function locate(hay: Normalised, needle: string, hint: number | undefined): [number, number] | null {
  const n = needle.trim();
  if (!n) return null;
  const occurrences: number[] = [];
  for (let i = hay.text.indexOf(n); i !== -1; i = hay.text.indexOf(n, i + 1)) occurrences.push(i);
  if (occurrences.length === 0) return null;
  let best = occurrences[0]!;
  if (hint !== undefined && occurrences.length > 1) {
    best = occurrences.reduce((a, b) => (Math.abs(hay.map[b]! - hint) < Math.abs(hay.map[a]! - hint) ? b : a));
  }
  const from = hay.map[best]!;
  const to = hay.map[best + n.length - 1]! + 1;
  return [from, to];
}
