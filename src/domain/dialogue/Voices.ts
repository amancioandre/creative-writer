import { blankComments, findDialogue, type DialogueConventions, type DialogueSpan } from "./DialogueSpans";
import { applyPins, attributeParagraphs, knownTo, pinEdit, type Attribution, type Pin, type Speaker } from "./Speakers";

/**
 * Who speaks each paragraph of a note, for the manuscript page: the same
 * analysis the editor runs, over the page's blocks in reading order.
 */
export interface VoicedBlock {
  readonly spans: readonly DialogueSpan[];
  readonly pins: readonly Pin[];
  readonly pin: Pin | null;
  readonly attribution: Attribution | null;
  /** One per span: its own pin, else the paragraph's. */
  readonly voices: readonly (Attribution | null)[];
}

export interface BlockText {
  /** The block's source; a heading as `# text`, so it starts the scene over. */
  readonly text: string;
}

export function attributeBlocks(blocks: readonly BlockText[], conventions: DialogueConventions, roster: readonly Speaker[]): VoicedBlock[] {
  const known = knownTo(roster);
  const paragraphs = blocks.map((b) => ({ text: b.text, ...applyPins(b.text, findDialogue(blankComments(b.text), conventions), known) }));
  const attributed = attributeParagraphs(paragraphs, roster);
  return paragraphs.map((p, i) => ({ spans: p.spans, pins: p.pins, pin: p.pin, attribution: attributed[i]?.attribution ?? null, voices: attributed[i]?.spans ?? [] }));
}

/** A block's markdown with a pin written before its span `index` (or replaced, or removed with `null`). */
export function pinBlock(markdown: string, voiced: VoicedBlock, index: number, label: string | null): string {
  const span = voiced.spans[index];
  if (!span) return markdown;
  const e = pinEdit(voiced.pins, span, label);
  return markdown.slice(0, e.from) + e.insert + markdown.slice(e.to);
}
