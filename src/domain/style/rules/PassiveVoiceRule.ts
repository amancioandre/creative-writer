import { Finding } from "../Finding";
import type { StyleRule } from "../StyleRule";
import { tokenize, type Token } from "../Tokenizer";
import { IRREGULAR_PARTICIPLES, STATIVE_PARTICIPLES } from "../lexicon/participles";

const AUXILIARIES = new Set(["is", "are", "was", "were", "be", "been", "being", "am", "get", "gets", "got", "gotten", "getting"]);
const MODALS = new Set(["will", "would", "shall", "should", "can", "could", "may", "might", "must", "has", "have", "had"]);
const ADVERB = /ly$/;

const isParticiple = (w: string) =>
  IRREGULAR_PARTICIPLES.has(w) || (w.length > 3 && (w.endsWith("ed") || w.endsWith("en")) && !w.endsWith("een"));

/**
 * Passive voice: auxiliary (be/get, optionally after a modal or "been"/"being"),
 * optional adverbs, past participle. Stative participles ("was tired") and
 * progressives ("was running") are excluded.
 */
export class PassiveVoiceRule implements StyleRule {
  analyse(text: string): Finding[] {
    const tokens = tokenize(text);
    const findings: Finding[] = [];
    let i = 0;
    while (i < tokens.length) {
      const span = this.matchAt(tokens, i);
      if (span) {
        findings.push(
          Finding.create("passive", tokens[i]!.from, tokens[span - 1]!.to, "Passive voice. Who is doing this? Put them in front of the verb."),
        );
        i = span;
      } else {
        i += 1;
      }
    }
    return findings;
  }

  /** Returns the exclusive end token index of a passive construction starting at `i`, or null. */
  private matchAt(tokens: readonly Token[], i: number): number | null {
    let j = i;
    if (MODALS.has(tokens[j]?.text ?? "")) j += 1;
    if (!AUXILIARIES.has(tokens[j]?.text ?? "")) return null;
    j += 1;
    // "is being", "has been", "will be". "being" makes it unambiguously a process, not a state.
    let progressive = false;
    while (j < tokens.length && (tokens[j]!.text === "being" || tokens[j]!.text === "been")) {
      if (tokens[j]!.text === "being") progressive = true;
      j += 1;
    }
    while (j < tokens.length && ADVERB.test(tokens[j]!.text)) j += 1;
    const head = tokens[j];
    if (!head || head.startsSentence) return null;
    if (!progressive && STATIVE_PARTICIPLES.has(head.text)) return null;
    if (!isParticiple(head.text)) return null;
    return j + 1;
  }
}
