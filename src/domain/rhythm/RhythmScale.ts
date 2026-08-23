/**
 * Defines how many rhythm tiers exist and where the boundaries between them
 * fall, expressed in "effective length" units (see RhythmClassifier).
 *
 * Boundaries are absolute rather than relative to the paragraph so that a
 * colour always means the same thing: a 5-word sentence is always "short".
 */
export class RhythmScale {
  static readonly MIN_TIERS = 4;
  static readonly MAX_TIERS = 6;

  private constructor(readonly boundaries: readonly number[]) {}

  /** Default boundaries per tier count, tuned for English prose. */
  static withTiers(tierCount: number): RhythmScale {
    if (!Number.isInteger(tierCount) || tierCount < RhythmScale.MIN_TIERS || tierCount > RhythmScale.MAX_TIERS) {
      throw new RangeError(`Rhythm tier count must be an integer in ${RhythmScale.MIN_TIERS}..${RhythmScale.MAX_TIERS}, got ${tierCount}`);
    }
    const presets: Record<number, readonly number[]> = {
      4: [6, 14, 26],
      5: [5, 11, 19, 30],
      6: [4, 9, 15, 23, 34],
    };
    return new RhythmScale(presets[tierCount]!);
  }

  get tierCount(): number {
    return this.boundaries.length + 1;
  }

  /** Maps an effective length onto a 1-based tier. */
  tierFor(effectiveLength: number): number {
    let tier = 1;
    for (const boundary of this.boundaries) {
      if (effectiveLength >= boundary) tier += 1;
      else break;
    }
    return tier;
  }
}
