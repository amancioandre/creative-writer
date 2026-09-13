import { locateQuote } from "../text/LocateQuote";
import type { Anchor } from "./Thread";

/**
 * A stop's quote, found in its scene. The writer anchors a stop with a
 * quoted string on the line (`plant: "she pocketed the letter"`), and the
 * quote is looked up in the raw note between the scene's heading and the
 * next one — loosely, so emphasis marks, curly quotes and a reflowed line
 * do not break it. Nothing is ever written into the note to hold the
 * place: the quote is the anchor, and when it stops matching the stop is
 * reported as broken, like a dead link.
 */
export function anchorQuote(noteText: string, sceneLine: number, nextSceneLine: number, quote: string): Anchor | null {
  const lines = noteText.split("\n");
  const from = Math.max(0, sceneLine), to = Math.min(lines.length, nextSceneLine < 0 ? lines.length : nextSceneLine);
  if (from >= to) return null;
  const slice = lines.slice(from, to).map(plainLine).join("\n");
  const hit = locateQuote(slice, quote);
  if (!hit) return null;
  const head = slice.slice(0, hit[0]);
  const nl = head.lastIndexOf("\n");
  return { line: from + (head.match(/\n/g) ?? []).length, ch: hit[0] - (nl + 1) };
}

/**
 * Emphasis and link marks removed, every character kept in place: a
 * stripped character becomes a space so offsets still map onto the raw
 * line. `normalise` then folds the space runs away.
 */
function plainLine(line: string): string {
  return line.replace(/[*_~=]{1,3}|\[\[|\]\]|%%/g, (m) => " ".repeat(m.length));
}
