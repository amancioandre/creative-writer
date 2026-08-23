/**
 * Minimal read-only view over a document's lines. The domain reasons about
 * paragraphs through this port so it never depends on CodeMirror's `Text`.
 */
export interface LineSource {
  readonly lineCount: number;
  /** 0-based. */
  lineText(index: number): string;
}

export class ArrayLineSource implements LineSource {
  constructor(private readonly lines: readonly string[]) {}
  get lineCount(): number {
    return this.lines.length;
  }
  lineText(index: number): string {
    return this.lines[index] ?? "";
  }
}
