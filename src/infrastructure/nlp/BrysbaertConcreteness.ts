import type { Concreteness } from "../../domain/style/Concreteness";
import { CONCRETENESS_DATA } from "./concreteness.data";

/**
 * Brysbaert, Warriner & Kuperman (2014) concreteness norms, CC-BY 4.0.
 * Parsed lazily on first use; ~16k frequent lemmas.
 */
export class BrysbaertConcreteness implements Concreteness {
  private table: Map<string, number> | null = null;

  score(word: string): number | null {
    const t = this.load();
    const w = word.toLowerCase();
    for (const candidate of lemmaCandidates(w)) {
      const s = t.get(candidate);
      if (s !== undefined) return s;
    }
    return null;
  }

  private load(): Map<string, number> {
    if (this.table) return this.table;
    const m = new Map<string, number>();
    for (const entry of CONCRETENESS_DATA.split(" ")) {
      m.set(entry.slice(0, -2), Number(entry.slice(-2)) / 10);
    }
    return (this.table = m);
  }
}

/** The word itself, then cheap de-inflections in order of likelihood. */
export function lemmaCandidates(w: string): string[] {
  const out = [w];
  if (w.endsWith("ies") && w.length > 4) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("ves") && w.length > 4) out.push(w.slice(0, -3) + "fe", w.slice(0, -3) + "f");
  if (w.endsWith("es") && w.length > 3) out.push(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) out.push(w.slice(0, -1));
  if (w.endsWith("ied") && w.length > 4) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("ed") && w.length > 3) out.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith("ing") && w.length > 4) out.push(w.slice(0, -3), w.slice(0, -3) + "e");
  if (/(.)\1(ed|ing)$/.test(w)) out.push(w.replace(/(.)\1(ed|ing)$/, "$1")); // stopped → stop
  if (w.endsWith("er") && w.length > 4) out.push(w.slice(0, -2));
  if (w.endsWith("ly") && w.length > 4) out.push(w.slice(0, -2));
  return out;
}
