import { describe, it, expect } from "vitest";
import { ZenMode } from "../../../src/domain/zen/ZenMode";

describe("ZenMode aggregate", () => {
  it("starts inactive", () => {
    expect(ZenMode.inactive().isActive).toBe(false);
  });

  it("toggles", () => {
    const on = ZenMode.inactive().toggle();
    expect(on.isActive).toBe(true);
    expect(on.toggle().isActive).toBe(false);
  });

  it("is immutable — toggling returns a new instance", () => {
    const a = ZenMode.inactive();
    a.toggle();
    expect(a.isActive).toBe(false);
  });
});
