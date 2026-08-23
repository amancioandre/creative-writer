import { quoteAppears } from "../style/llm/validateFindings";

export interface MythPattern {
  readonly name: string;
  readonly evidence: string;
  readonly note: string;
}

export interface Archetype {
  readonly name: string;
  readonly character: string;
  readonly evidence: string;
}

const MAX_ITEMS = 8;
const MAX_TEXT = 600;

/**
 * What a model says a passage is echoing. Unlike style findings this is a
 * report, not marks: evidence is quoted, and anything whose quote is not
 * actually in the passage is dropped — the one guard against a model that
 * sees Campbell everywhere.
 */
export class MythReport {
  private constructor(
    readonly patterns: readonly MythPattern[],
    readonly archetypes: readonly Archetype[],
    readonly summary: string,
    readonly next: string,
  ) {}

  static create(patterns: readonly MythPattern[], archetypes: readonly Archetype[], summary: string, next: string): MythReport {
    return new MythReport(patterns, archetypes, summary, next);
  }

  get isEmpty(): boolean {
    return this.patterns.length === 0 && this.archetypes.length === 0 && this.summary.length === 0;
  }
}

export function validateMythReport(raw: unknown, text: string): MythReport {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");
  const list = (v: unknown) => (Array.isArray(v) ? v : []);

  const patterns: MythPattern[] = [];
  for (const p of list(r.patterns)) {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const name = str(o.name), evidence = str(o.evidence), note = str(o.note);
    if (!name || !evidence || !quoteAppears(text, evidence)) continue;
    patterns.push({ name, evidence, note });
    if (patterns.length >= MAX_ITEMS) break;
  }

  const archetypes: Archetype[] = [];
  for (const a of list(r.archetypes)) {
    const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    const name = str(o.name), character = str(o.character), evidence = str(o.evidence);
    if (!name || !evidence || !quoteAppears(text, evidence)) continue;
    archetypes.push({ name, character, evidence });
    if (archetypes.length >= MAX_ITEMS) break;
  }

  return MythReport.create(patterns, archetypes, str(r.summary), str(r.next));
}
