/**
 * A sentence as located inside a paragraph.
 *
 * Value object: immutable, compared by value. Offsets (`from`, `to`) are
 * relative to whatever text the sentence was segmented from — the domain does
 * not know about documents, only about a span of text and its position.
 */
export class Sentence {
  private constructor(
    readonly text: string,
    readonly from: number,
    readonly to: number,
  ) {}

  static create(text: string, from: number, to: number): Sentence {
    if (to < from) throw new RangeError(`Sentence range is inverted: ${from}..${to}`);
    if (to - from !== text.length) {
      throw new RangeError(`Sentence text length ${text.length} does not match range ${from}..${to}`);
    }
    return new Sentence(text, from, to);
  }

  get length(): number {
    return this.to - this.from;
  }

  get isBlank(): boolean {
    return this.text.trim().length === 0;
  }

  equals(other: Sentence): boolean {
    return this.text === other.text && this.from === other.from && this.to === other.to;
  }
}
