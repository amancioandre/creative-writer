import { Finding } from "../Finding";
import type { StyleRule } from "../StyleRule";
import { tokenize } from "../Tokenizer";
import { PhraseMatcher } from "./PhraseMatcher";
import { CLICHES } from "../lexicon/cliches";

export class ClicheRule implements StyleRule {
  private readonly matcher: PhraseMatcher<string>;

  constructor(phrases: readonly string[] = CLICHES) {
    this.matcher = new PhraseMatcher(phrases.map((p) => [p, p] as const));
  }

  analyse(text: string): Finding[] {
    return this.matcher
      .findAll(tokenize(text))
      .map((m) => Finding.create("cliche", m.from, m.to, `Cliché: "${m.value}". Say what you actually saw.`));
  }
}
