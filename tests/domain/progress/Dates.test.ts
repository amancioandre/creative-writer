import { describe, it, expect } from "vitest";
import { addDays, daysBetween, isDay, toDay, weekday } from "../../../src/domain/progress/Dates";

describe("Dates", () => {
  it("formats local dates with zero padding", () => {
    expect(toDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("numbers weekdays Monday-first", () => {
    expect(weekday("2026-08-24")).toBe(0); // a Monday
    expect(weekday("2026-08-30")).toBe(6);
  });
  it("validates the day format", () => {
    expect(isDay("2026-08-24")).toBe(true);
    expect(isDay("24/08/2026")).toBe(false);
    expect(isDay(42)).toBe(false);
  });
  it("counts days between", () => {
    expect(daysBetween("2026-08-24", "2026-09-01")).toBe(8);
    expect(daysBetween("2026-09-01", "2026-08-24")).toBe(-8);
  });
});
