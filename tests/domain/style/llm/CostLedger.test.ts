import { describe, it, expect } from "vitest";
import { CostLedger, costOf, PRICES } from "../../../../src/domain/style/llm/CostLedger";

describe("costOf", () => {
  it("prices input, output, cache reads (10%) and cache writes (125%) per million tokens", () => {
    const usd = costOf({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }, PRICES["claude-opus-5"]);
    expect(usd).toBeCloseTo(5);
    expect(costOf({ input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, PRICES["claude-opus-5"])).toBeCloseTo(25);
    expect(costOf({ input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 }, PRICES["claude-opus-5"])).toBeCloseTo(0.5);
    expect(costOf({ input: 0, output: 0, cacheRead: 0, cacheWrite: 1_000_000 }, PRICES["claude-opus-5"])).toBeCloseTo(6.25);
  });
  it("a typical per-paragraph call on Opus 5 with a cached rulebook costs about a cent", () => {
    const usd = costOf({ input: 300, output: 250, cacheRead: 1200, cacheWrite: 0 }, PRICES["claude-opus-5"]);
    expect(usd).toBeGreaterThan(0.005);
    expect(usd).toBeLessThan(0.012);
  });
});

describe("CostLedger", () => {
  it("accumulates session and daily spend", () => {
    const l = CostLedger.fromPersisted({ day: "2026-08-23", usd: 0.40 }, () => "2026-08-23");
    l.add(0.05);
    expect(l.sessionUsd).toBeCloseTo(0.05);
    expect(l.todayUsd).toBeCloseTo(0.45);
  });
  it("resets the daily total on a new day", () => {
    const l = CostLedger.fromPersisted({ day: "2026-08-22", usd: 3 }, () => "2026-08-23");
    expect(l.todayUsd).toBe(0);
    l.add(0.1);
    expect(l.persisted()).toEqual({ day: "2026-08-23", usd: 0.1 });
  });
  it("reports when a daily cap is reached (cap 0 = unlimited)", () => {
    const l = CostLedger.fromPersisted({ day: "2026-08-23", usd: 0.99 }, () => "2026-08-23");
    expect(l.capReached(1.0)).toBe(false);
    l.add(0.02);
    expect(l.capReached(1.0)).toBe(true);
    expect(l.capReached(0)).toBe(false);
  });
  it("tolerates missing persisted state", () => {
    expect(CostLedger.fromPersisted(undefined, () => "2026-08-23").todayUsd).toBe(0);
  });
});
