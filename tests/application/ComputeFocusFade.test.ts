import { describe, it, expect } from "vitest";
import { ComputeFocusFade } from "../../src/application/use-cases/ComputeFocusFade";

describe("ComputeFocusFade", () => {
  const useCase = new ComputeFocusFade();

  it("assigns tiers to each visible line by distance from the cursor line", () => {
    const result = useCase.execute({ visibleLines: [3, 4, 5, 6, 7, 8], cursorLine: 5 });
    expect(result).toEqual([
      { line: 3, tier: 2 },
      { line: 4, tier: 1 },
      { line: 5, tier: 0 },
      { line: 6, tier: 1 },
      { line: 7, tier: 2 },
      { line: 8, tier: 3 },
    ]);
  });

  it("returns an empty list for no visible lines", () => {
    expect(useCase.execute({ visibleLines: [], cursorLine: 0 })).toEqual([]);
  });
});
