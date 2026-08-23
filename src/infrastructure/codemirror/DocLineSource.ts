import type { Text } from "@codemirror/state";
import type { LineSource } from "../../domain/text/LineSource";

/** Adapts CodeMirror's rope `Text` to the domain's line port (0-based). */
export class DocLineSource implements LineSource {
  constructor(private readonly doc: Text) {}
  get lineCount(): number {
    return this.doc.lines;
  }
  lineText(index: number): string {
    return this.doc.line(index + 1).text;
  }
}
