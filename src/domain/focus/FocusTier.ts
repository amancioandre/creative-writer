/**
 * How far a line is from the cursor line, bucketed for fading. Tier 0 is the
 * line being written; higher tiers fade progressively. CSS owns the opacity.
 */
export const FocusTier = {
  Current: 0,
  Near: 1,
  Mid: 2,
  Far: 3,
} as const;

export const DEFAULT_MAX_FOCUS_TIER = FocusTier.Far;

export function focusTierFor(lineDistance: number, maxTier: number = DEFAULT_MAX_FOCUS_TIER): number {
  return Math.min(Math.abs(lineDistance), maxTier);
}
