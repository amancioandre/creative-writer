export type FindingKind = "cliche" | "passive" | "weak" | "filter" | "adverb" | "repetition";

export const FINDING_KINDS: readonly FindingKind[] = ["cliche", "passive", "weak", "filter", "adverb", "repetition"];

/**
 * One thing a style rule wants the writer to look at: a range and a note.
 * Offsets are relative to the analysed text until `shifted()` makes them absolute.
 */
export class Finding {
  private constructor(
    readonly kind: FindingKind,
    readonly from: number,
    readonly to: number,
    readonly note: string,
  ) {}

  static create(kind: FindingKind, from: number, to: number, note: string): Finding {
    if (to <= from) throw new RangeError(`Finding range must be non-empty: ${from}..${to}`);
    return new Finding(kind, from, to, note);
  }

  shifted(by: number): Finding {
    return new Finding(this.kind, this.from + by, this.to + by, this.note);
  }
}
