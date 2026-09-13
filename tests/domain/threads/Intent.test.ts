import { describe, it, expect } from "vitest";
import { intentLine, validateIntent } from "../../../src/domain/threads/Intent";

describe("validateIntent", () => {
  it("keeps a verdict from the list, caps the reason, clamps the confidence, and takes a percentage as a fraction", () => {
    expect(validateIntent({ verdict: "Reversal", reason: "  she dyes\n her hair ", confidence: 0.82 })).toEqual({ verdict: "reversal", reason: "she dyes her hair", confidence: 0.82 });
    expect(validateIntent({ verdict: "same", reason: "x".repeat(400), confidence: 72 })).toMatchObject({ verdict: "same", confidence: 0.72 });
    expect(validateIntent({ verdict: "same", reason: "x".repeat(400), confidence: 72 })!.reason).toHaveLength(240);
    expect(validateIntent({ verdict: "error", confidence: 9 })).toEqual({ verdict: "error", reason: "", confidence: 0.09 });
    expect(validateIntent({ verdict: "error", confidence: 150 })).toEqual({ verdict: "error", reason: "", confidence: 1 });
    expect(validateIntent({ verdict: "error", confidence: -2 })).toEqual({ verdict: "error", reason: "", confidence: 0 });
    expect(validateIntent({ verdict: "error" })).toEqual({ verdict: "error", reason: "", confidence: 0.5 });
  });

  it("drops anything else", () => {
    expect(validateIntent({ verdict: "maybe", reason: "?" })).toBeNull();
    expect(validateIntent(null)).toBeNull();
    expect(validateIntent("reversal")).toBeNull();
  });
});

describe("intentLine", () => {
  it("says what the model read, why, and how sure", () => {
    expect(intentLine({ verdict: "reversal", reason: "she dyes her hair", confidence: 0.82 })).toBe("The model reads this as a reversal: she dyes her hair (82%)");
    expect(intentLine({ verdict: "error", reason: "", confidence: 0.5 })).toBe("The model reads this as an error (50%)");
    expect(intentLine({ verdict: "same", reason: "grey and gray", confidence: 1 })).toBe("The model reads these as the same thing: grey and gray (100%)");
  });
});
