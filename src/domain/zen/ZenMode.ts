/** Immutable on/off aggregate for Zen Mode. Trivial today; a seam for later (e.g. timed sessions). */
export class ZenMode {
  private constructor(readonly isActive: boolean) {}

  static inactive(): ZenMode {
    return new ZenMode(false);
  }

  toggle(): ZenMode {
    return new ZenMode(!this.isActive);
  }
}
