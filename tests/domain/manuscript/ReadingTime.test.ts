import { describe, it, expect } from "vitest";
import { DEFAULT_READING_SPEED, formatReadingTime, readingMinutes } from "../../../src/domain/manuscript/ReadingTime";

describe("readingMinutes", () => {
  it("rounds to whole minutes at the given speed and never drops below one", () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(3)).toBe(1);
    expect(readingMinutes(2500)).toBe(10);
    expect(readingMinutes(2500, 500)).toBe(5);
    expect(readingMinutes(3125)).toBe(13);
  });
  it("falls back to the default speed on a nonsense one", () => {
    expect(readingMinutes(2500, 0)).toBe(2500 / DEFAULT_READING_SPEED);
    expect(readingMinutes(2500, Number.NaN)).toBe(10);
    expect(readingMinutes(Number.NaN)).toBe(0);
  });
});

describe("formatReadingTime", () => {
  it("says nothing for no words and 'under a minute' for a few", () => {
    expect(formatReadingTime(0)).toBe("");
    expect(formatReadingTime(15)).toBe("under a minute");
    expect(formatReadingTime(124)).toBe("under a minute");
    expect(formatReadingTime(125)).toBe("1 min");
  });
  it("shows minutes under an hour and hours with a remainder above", () => {
    expect(formatReadingTime(3000)).toBe("12 min");
    expect(formatReadingTime(15000)).toBe("1 h");
    expect(formatReadingTime(90000)).toBe("6 h");
    expect(formatReadingTime(83750)).toBe("5 h 35 min");
  });
  it("follows the writer's own speed", () => {
    expect(formatReadingTime(3000, 300)).toBe("10 min");
    expect(formatReadingTime(3000, 100)).toBe("30 min");
  });
});
