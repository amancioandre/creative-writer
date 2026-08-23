import { describe, it, expect } from "vitest";
import { focusTierFor, FocusTier } from "../../../src/domain/focus/FocusTier";

describe("focusTierFor", () => {
  it("gives the cursor line tier 0 (fully visible)", () => {
    expect(focusTierFor(0)).toBe(FocusTier.Current);
  });

  it("gives adjacent lines tier 1, next ring tier 2, everything further tier 3", () => {
    expect(focusTierFor(1)).toBe(1);
    expect(focusTierFor(-1)).toBe(1);
    expect(focusTierFor(2)).toBe(2);
    expect(focusTierFor(-2)).toBe(2);
    expect(focusTierFor(3)).toBe(3);
    expect(focusTierFor(40)).toBe(3);
  });

  it("caps at the requested maximum tier", () => {
    expect(focusTierFor(7, 2)).toBe(2);
  });
});
