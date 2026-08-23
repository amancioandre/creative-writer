import type { Finding } from "./Finding";

/** A pure style check over one paragraph's text. Findings use text-relative offsets. */
export interface StyleRule {
  analyse(text: string): Finding[];
}
