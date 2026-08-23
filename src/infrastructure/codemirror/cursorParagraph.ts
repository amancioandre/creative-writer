import type { EditorState } from "@codemirror/state";
import { DocLineSource } from "./DocLineSource";
import { locateParagraph } from "../../domain/text/Paragraph";

export interface CursorParagraph {
  readonly text: string;
  readonly from: number;
  readonly to: number;
}

/** The paragraph under the main cursor, or null on a blank line. */
export function cursorParagraph(state: EditorState): CursorParagraph | null {
  const doc = state.doc;
  const cursorLine = doc.lineAt(state.selection.main.head).number - 1;
  const p = locateParagraph(new DocLineSource(doc), cursorLine);
  if (!p) return null;
  const from = doc.line(p.firstLine + 1).from;
  const to = doc.line(p.lastLine + 1).to;
  return { text: doc.sliceString(from, to), from, to };
}
