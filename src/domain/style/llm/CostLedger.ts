export interface Usage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

/** USD per million tokens. Cache reads bill at 10% of input, cache writes at 125%. */
export interface Price {
  readonly input: number;
  readonly output: number;
}

export const PRICES: Readonly<Record<"claude-opus-5" | "claude-haiku-4-5", Price>> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function costOf(u: Usage, p: Price): number {
  const perTok = (usd: number) => usd / 1_000_000;
  return u.input * perTok(p.input) + u.output * perTok(p.output) + u.cacheRead * perTok(p.input * 0.1) + u.cacheWrite * perTok(p.input * 1.25);
}

export interface PersistedSpend {
  readonly day: string; // YYYY-MM-DD
  readonly usd: number;
}

/**
 * Tracks what the model assistant has cost this session and today, so a
 * daily cap can stop it. "Today" is the local calendar day; the daily total
 * is persisted in settings and survives restarts.
 */
export class CostLedger {
  private today: PersistedSpend;
  private session = 0;

  private constructor(today: PersistedSpend, private readonly dayNow: () => string) {
    this.today = today;
  }

  static fromPersisted(p: PersistedSpend | undefined, dayNow: () => string = localDay): CostLedger {
    const day = dayNow();
    return new CostLedger(p && p.day === day && Number.isFinite(p.usd) ? p : { day, usd: 0 }, dayNow);
  }

  add(usd: number): void {
    this.roll();
    this.session += usd;
    this.today = { day: this.today.day, usd: this.today.usd + usd };
  }

  get sessionUsd(): number {
    return this.session;
  }

  get todayUsd(): number {
    this.roll();
    return this.today.usd;
  }

  /** Cap of 0 means unlimited. */
  capReached(capUsd: number): boolean {
    return capUsd > 0 && this.todayUsd >= capUsd;
  }

  persisted(): PersistedSpend {
    this.roll();
    return this.today;
  }

  private roll(): void {
    const day = this.dayNow();
    if (day !== this.today.day) this.today = { day, usd: 0 };
  }
}

export function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
