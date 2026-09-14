import { findDialogue, type DialogueConventions, type DialogueSpan } from "./DialogueSpans";
import { attributeSpeakers, pinComment, pinOf, type Attribution, type Pin, type Speaker } from "./Speakers";

/**
 * Who speaks each paragraph of a note, for the manuscript page: the same
 * analysis the editor runs, over the page's blocks in reading order.
 */
export interface VoicedBlock {
  readonly spans: readonly DialogueSpan[];
  readonly pin: Pin | null;
  readonly attribution: Attribution | null;
}

export interface BlockText {
  /** The block's source; a heading as `# text`, so it starts the scene over. */
  readonly text: string;
}

export function attributeBlocks(blocks: readonly BlockText[], conventions: DialogueConventions, roster: readonly Speaker[]): VoicedBlock[] {
  const paragraphs = blocks.map((b) => {
    const pin = pinOf(b.text);
    const body = pin ? " ".repeat(pin.to) + b.text.slice(pin.to) : b.text;
    return { text: b.text, pin, spans: pin?.notSpeech ? [] : findDialogue(body, conventions) };
  });
  const attributions = attributeSpeakers(paragraphs, roster);
  return paragraphs.map((p, i) => ({ spans: p.spans, pin: p.pin, attribution: attributions[i] ?? null }));
}

/** A note's text with the pin on one line written, replaced, or removed (`null`). */
export function pinLine(text: string, line: number, label: string | null): string {
  const lines = text.split("\n");
  const at = Math.max(0, Math.min(line, lines.length - 1));
  const current = lines[at] ?? "";
  const pin = pinOf(current);
  const rest = pin ? current.slice(pin.to) : current.replace(/^\s*/, "");
  const lead = pin ? current.slice(0, pin.from) : current.match(/^\s*/)?.[0] ?? "";
  lines[at] = label === null ? `${lead}${rest}` : `${lead}${pinComment(label)} ${rest}`;
  return lines.join("\n");
}
