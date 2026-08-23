import { describe, it, expect } from "vitest";
import { Finding } from "../../../src/domain/style/Finding";

describe("Finding", () => {
  it("carries kind, range and note", () => {
    const f = Finding.create("cliche", 3, 10, "Tired phrase.");
    expect(f).toMatchObject({ kind: "cliche", from: 3, to: 10, note: "Tired phrase." });
  });
  it("rejects empty or inverted ranges", () => {
    expect(() => Finding.create("cliche", 5, 5, "x")).toThrow();
    expect(() => Finding.create("cliche", 6, 5, "x")).toThrow();
  });
  it("shifts by an offset", () => {
    expect(Finding.create("passive", 1, 4, "n").shifted(100)).toMatchObject({ from: 101, to: 104 });
  });
});
