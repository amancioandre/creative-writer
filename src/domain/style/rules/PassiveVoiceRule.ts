import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import { tokenize, type Token } from "../Tokenizer";
import { IRREGULAR_PARTICIPLES, STATIVE_PARTICIPLES } from "../lexicon/participles";
import { indexByOffset, type PosTagger, type TaggedToken } from "../PosTagger";

const AUXILIARIES = new Set(["is", "are", "was", "were", "be", "been", "being", "am", "get", "gets", "got", "gotten", "getting"]);
const MODALS = new Set(["will", "would", "shall", "should", "can", "could", "may", "might", "must", "has", "have", "had"]);
const ADVERB = /ly$/;

const looksLikeParticiple = (w: string) =>
  IRREGULAR_PARTICIPLES.has(w) || (w.length > 3 && (w.endsWith("ed") || w.endsWith("en")) && !w.endsWith("een"));

/**
 * Passive voice: auxiliary (be/get, optionally after a modal or "been"/"being"),
 * optional adverbs, past participle.
 *
 * Without a tagger: participles are guessed from shape; a stative list
 * ("was tired") suppresses false positives.
 * With a tagger: the head must carry a Participle/Passive tag, and a
 * stative word is still accepted when an agent follows ("was closed by the
 * council") or the form is progressive ("was being closed").
 */
export class PassiveVoiceRule implements StyleRule {
  constructor(private readonly tagger?: PosTagger) {}

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger ?? null)): Finding[] {
    const tokens = tokenize(text);
    const tagged = ctx.hasTagger ? indexByOffset(ctx.tagged()) : null;
    const findings: Finding[] = [];
    let i = 0;
    while (i < tokens.length) {
      const end = this.matchAt(tokens, i, tagged);
      if (end) {
        findings.push(
          Finding.create("passive", tokens[i]!.from, tokens[end - 1]!.to, "Passive voice. Who is doing this? Put them in front of the verb."),
        );
        i = end;
      } else {
        i += 1;
      }
    }
    return findings;
  }

  /** Returns the exclusive end token index of a passive construction starting at `i`, or null. */
  private matchAt(tokens: readonly Token[], i: number, tagged: Map<number, TaggedToken> | null): number | null {
    let j = i;
    if (MODALS.has(tokens[j]?.text ?? "")) j += 1;
    if (!AUXILIARIES.has(tokens[j]?.text ?? "")) return null;
    j += 1;
    let progressive = false;
    while (j < tokens.length && (tokens[j]!.text === "being" || tokens[j]!.text === "been")) {
      if (tokens[j]!.text === "being") progressive = true;
      j += 1;
    }
    while (j < tokens.length && ADVERB.test(tokens[j]!.text)) j += 1;
    const head = tokens[j];
    if (!head || head.startsSentence) return null;

    const tag = tagged?.get(head.from);
    // After "being" the tagger tends to call the participle an adjective ("is being closed"); shape is more reliable there.
    const isParticiple = tag && !progressive ? tag.tags.has("Participle") || tag.tags.has("Passive") : looksLikeParticiple(head.text);
    if (!isParticiple) return null;
    if (!progressive && tag?.tags.has("Adjective") && !tag.tags.has("Verb")) return null;

    if (STATIVE_PARTICIPLES.has(head.text) && !progressive && !this.hasAgent(tokens, j + 1)) return null;
    return j + 1;
  }

  /** "… by <something>" in the same sentence — the surest sign of a true passive. */
  private hasAgent(tokens: readonly Token[], from: number): boolean {
    for (let k = from; k < Math.min(tokens.length, from + 3); k++) {
      if (tokens[k]!.startsSentence) return false;
      if (tokens[k]!.text === "by") return k + 1 < tokens.length && !tokens[k + 1]!.startsSentence;
    }
    return false;
  }
}
