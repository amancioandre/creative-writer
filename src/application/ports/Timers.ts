/**
 * Timer functions, injected so application code never touches globals.
 * Obsidian pop-out windows need the owning window's timers, not the main
 * window's; infrastructure supplies `window.setTimeout` etc.
 */
export interface Timers {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}
