import type { Token } from "../Tokenizer";

/**
 * Matches multi-word phrases against a token stream. Phrases are stored in a
 * trie keyed by word, so matching is O(tokens × longest phrase) regardless
 * of how many phrases the lexicon holds. Longest match wins; matches never
 * cross a sentence boundary.
 */
interface TrieNode<T> {
  readonly next: Map<string, TrieNode<T>>;
  value?: T;
}

export interface PhraseMatch<T> {
  readonly from: number;
  readonly to: number;
  readonly tokenStart: number;
  readonly tokenEnd: number; // exclusive
  readonly value: T;
}

export class PhraseMatcher<T> {
  private readonly root: TrieNode<T> = { next: new Map() };

  constructor(entries: Iterable<readonly [phrase: string, value: T]>) {
    for (const [phrase, value] of entries) {
      let node = this.root;
      for (const word of phrase.split(/\s+/)) {
        let child = node.next.get(word);
        if (!child) {
          child = { next: new Map() };
          node.next.set(word, child);
        }
        node = child;
      }
      node.value = value;
    }
  }

  /** Non-overlapping, longest-first, left-to-right. */
  findAll(tokens: readonly Token[]): PhraseMatch<T>[] {
    const out: PhraseMatch<T>[] = [];
    let i = 0;
    while (i < tokens.length) {
      const match = this.longestAt(tokens, i);
      if (match) {
        out.push(match);
        i = match.tokenEnd;
      } else {
        i += 1;
      }
    }
    return out;
  }

  private longestAt(tokens: readonly Token[], start: number): PhraseMatch<T> | null {
    let node = this.root;
    let best: PhraseMatch<T> | null = null;
    for (let j = start; j < tokens.length; j++) {
      const tok = tokens[j]!;
      if (j > start && tok.startsSentence) break;
      const next = node.next.get(tok.text);
      if (!next) break;
      node = next;
      if (node.value !== undefined) {
        best = { from: tokens[start]!.from, to: tok.to, tokenStart: start, tokenEnd: j + 1, value: node.value };
      }
    }
    return best;
  }
}
