/** Calendar days as local "YYYY-MM-DD" strings. Writers think in local days, not UTC. */
export type Day = string;

export function toDay(date: Date): Day {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(day: Day, n: number): Day {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return toDay(new Date(y, m - 1, d + n));
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: Day): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export function isDay(value: unknown): value is Day {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: Day, to: Day): number {
  const parse = (day: Day) => {
    const [y, m, d] = day.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}
