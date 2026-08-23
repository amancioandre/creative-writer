import { focusTierFor } from "../../domain/focus/FocusTier";

export interface FocusFadeInput {
  /** 0-based line numbers currently rendered in the viewport. */
  readonly visibleLines: readonly number[];
  readonly cursorLine: number;
}

export interface LineFocus {
  readonly line: number;
  readonly tier: number;
}

export class ComputeFocusFade {
  execute({ visibleLines, cursorLine }: FocusFadeInput): LineFocus[] {
    return visibleLines.map((line) => ({ line, tier: focusTierFor(line - cursorLine) }));
  }
}
