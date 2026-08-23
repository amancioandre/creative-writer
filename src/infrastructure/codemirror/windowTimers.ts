import type { Timers } from "../../application/ports/Timers";

/** Timers bound to a specific window — the one the editor lives in, so pop-outs work. */
export function windowTimers(win: Window): Timers {
  return {
    set: (fn, ms) => win.setTimeout(fn, ms),
    clear: (id) => win.clearTimeout(id),
  };
}
