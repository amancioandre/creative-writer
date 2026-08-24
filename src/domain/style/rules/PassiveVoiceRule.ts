import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import { tokenize, looksLikeName, type Token } from "../Tokenizer";
import { IRREGULAR_PARTICIPLES, NOT_PARTICIPLES, STATIVE_PARTICIPLES } from "../lexicon/participles";
import { indexByOffset, type PosTagger, type TaggedToken } from "../PosTagger";

const AUXILIARIES = new Set(["is", "are", "was", "were", "be", "been", "being", "am", "get", "gets", "got", "gotten", "getting"]);
const MODALS = new Set(["will", "would", "shall", "should", "can", "could", "may", "might", "must", "has", "have", "had", "having"]);
/** Words allowed between auxiliary and participle: adverbs, negation, quantifiers. */
const GAP = new Set(["not", "never", "just", "already", "still", "often", "all", "very", "ever", "also", "once", "so", "even", "both", "then", "soon", "now", "again", "quite", "rather", "well", "long", "since"]);
const PRONOUN = new Set(["i", "you", "he", "she", "it", "we", "they", "this", "that", "there"]);
/** "by then", "by the time": temporal, not an agent. */
const BY_TEMPORAL = /^(then|now|morning|night|noon|midnight|dawn|dusk|evening|tomorrow|yesterday|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)/;

/** Strip "n't" so "wasn't" and "won't" look up as "was" and "will". */
const bare = (w: string) => (w === "won't" ? "will" : w === "can't" ? "can" : w.replace(/n't$/, ""));

const looksLikeParticiple = (w: string) =>
  IRREGULAR_PARTICIPLES.has(w) ||
  (!NOT_PARTICIPLES.has(w) && w.length > 3 && (w.endsWith("ed") || w.endsWith("en")) && !w.endsWith("een"));

/**
 * Passive voice: auxiliary (be/get, optionally after modals and "have"),
 * optional adverbs/negation, past participle.
 *
 * Without a tagger: participles are guessed from shape; a stative list
 * ("was tired") and a not-a-participle list ("was eleven") suppress false
 * positives, as do capitalised names ("was Helen").
 * With a tagger: the head may carry a Participle/Passive/PastTense tag or
 * simply look like one (compromise misses "got hit", "was told"); a word
 * the tagger calls a plain adjective is only accepted with an agent. A
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
      const end = this.matchAt(text, tokens, i, tagged);
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
  private matchAt(text: string, tokens: readonly Token[], i: number, tagged: Map<number, TaggedToken> | null): number | null {
    let j = i;
    const inSentence = (k: number) => k < tokens.length && (k === i || !tokens[k]!.startsSentence);
    // "could have been", "had not been", "will never be"
    let hops = 0;
    while (inSentence(j) && hops < 4 && (MODALS.has(bare(tokens[j]!.text)) || (j > i && this.isGap(tokens[j]!, tagged)))) {
      j += 1;
      hops += 1;
    }
    if (!inSentence(j) || !AUXILIARIES.has(bare(tokens[j]!.text))) return null;
    const aux = tokens[j]!;
    j += 1;
    // "Was the letter sent?" — subject between auxiliary and participle in a question.
    if (aux.startsSentence && inSentence(j) && this.endsWithQuestion(text, tokens, j)) {
      if (PRONOUN.has(tokens[j]!.text)) j += 1;
      else if (/^(the|a|an|his|her|their|my|our|your|its)$/.test(tokens[j]!.text) && inSentence(j + 1)) j += 2;
    }
    let progressive = false;
    while (inSentence(j) && /^(being|been|getting)$/.test(tokens[j]!.text)) {
      if (tokens[j]!.text !== "been") progressive = true;
      j += 1;
    }
    while (inSentence(j) && this.isGap(tokens[j]!, tagged)) j += 1;
    if (!inSentence(j)) return null;
    const head = tokens[j]!;
    if (looksLikeName(text, head)) return null;

    const tag = tagged?.get(head.from);
    const agent = this.hasAgent(tokens, j + 1);
    const shape = looksLikeParticiple(head.text);
    const isParticiple = tag && !progressive
      ? tag.tags.has("Participle") || tag.tags.has("Passive") || (shape && (tag.tags.has("PastTense") || tag.tags.has("Verb") || agent || IRREGULAR_PARTICIPLES.has(head.text)))
      : shape;
    if (!isParticiple) return null;
    if (!progressive && !agent && tag?.tags.has("Adjective") && !tag.tags.has("Verb")) return null;
    if (STATIVE_PARTICIPLES.has(head.text) && !progressive && !agent) return null;
    return j + 1;
  }

  private isGap(tok: Token, tagged: Map<number, TaggedToken> | null): boolean {
    if (GAP.has(tok.text) || /ly$/.test(tok.text)) return true;
    return tagged?.get(tok.from)?.tags.has("Adverb") ?? false;
  }

  private endsWithQuestion(text: string, tokens: readonly Token[], from: number): boolean {
    let k = from;
    while (k + 1 < tokens.length && !tokens[k + 1]!.startsSentence) k += 1;
    const tail = text.slice(tokens[k]!.to, tokens[k + 1]?.from ?? text.length);
    return tail.includes("?");
  }

  /** "… by <agent>" later in the same sentence — the surest sign of a true passive. */
  private hasAgent(tokens: readonly Token[], from: number): boolean {
    for (let k = from; k < tokens.length; k++) {
      if (tokens[k]!.startsSentence) return false;
      if (tokens[k]!.text === "by") {
        const next = tokens[k + 1];
        if (!next || next.startsSentence) return false;
        if (BY_TEMPORAL.test(next.text)) return false;
        if (next.text === "the" && tokens[k + 2] && /^(time|morning|evening|end|way)$/.test(tokens[k + 2]!.text)) return false;
        return true;
      }
    }
    return false;
  }
}
