import { type EditorView, layer, RectangleMarker, type ViewUpdate } from "@codemirror/view";
import { effectiveSettings } from "./activeNote";
import { settingsChanged } from "./settingsFacet";

export const CURRENT_LINE_LAYER_CLASS = "czm-current-line-layer";
export const CURRENT_LINE_CLASS = "czm-current-line";
export const VEIL_LAYER_CLASS = "czm-paragraph-veil-layer";
export const VEIL_CLASS = "czm-paragraph-veil";

export interface Band {
  readonly top: number;
  readonly height: number;
  readonly width: number;
}

/**
 * Pure geometry: the cursor's visual line (one wrapped row, not the whole
 * paragraph) stretched to the full width of the scroller. `null` when the
 * cursor has no layout yet.
 */
export function bandFor(cursor: { readonly top: number; readonly height: number } | null, scrollerWidth: number): Band | null {
  if (!cursor || cursor.height <= 0 || scrollerWidth <= 0) return null;
  return { top: cursor.top, height: cursor.height, width: scrollerWidth };
}

/**
 * Pure geometry: the parts of the cursor paragraph that are *not* the cursor
 * row — above it and below it — as zero, one or two bands.
 */
export function veilsFor(paragraph: { readonly top: number; readonly bottom: number }, row: Band): Band[] {
  const out: Band[] = [];
  if (row.top - paragraph.top > 0.5) out.push({ top: paragraph.top, height: row.top - paragraph.top, width: row.width });
  const rowBottom = row.top + row.height;
  if (paragraph.bottom - rowBottom > 0.5) out.push({ top: rowBottom, height: paragraph.bottom - rowBottom, width: row.width });
  return out;
}

function cursorRow(view: EditorView): Band | null {
  const [cursor] = RectangleMarker.forRange(view, CURRENT_LINE_CLASS, view.state.selection.main);
  return bandFor(cursor ? { top: cursor.top, height: cursor.height } : null, view.scrollDOM.clientWidth);
}

const shouldUpdate = (u: ViewUpdate) => u.docChanged || u.selectionSet || u.geometryChanged || u.viewportChanged || settingsChanged(u);

/**
 * Two layers around the cursor's visual line:
 *
 *   - below the text, a faint band behind the row itself ("current line");
 *   - above the text, a translucent veil in the editor's background colour
 *     over the *rest of the cursor paragraph*, so the row reads at full
 *     strength, the paragraph slightly dimmed, and other paragraphs — faded
 *     by focus fade's opacity — dimmest. Text opacity can only be set per
 *     paragraph in CodeMirror; the veil is how a single row wins.
 *
 * Marker `left: 0` is the scroller's left edge in layer coordinates.
 */
export function currentLineExtension() {
  const band = layer({
    above: false,
    class: CURRENT_LINE_LAYER_CLASS,
    update: shouldUpdate,
    markers(view: EditorView) {
      if (!effectiveSettings(view.state).currentLineEnabled) return [];
      const row = cursorRow(view);
      return row ? [new RectangleMarker(CURRENT_LINE_CLASS, 0, row.top, row.width, row.height)] : [];
    },
  });
  const veil = layer({
    above: true,
    class: VEIL_LAYER_CLASS,
    update: shouldUpdate,
    markers(view: EditorView) {
      if (!effectiveSettings(view.state).focusFadeEnabled) return [];
      const row = cursorRow(view);
      const head = view.state.selection.main.head;
      const client = view.coordsAtPos(head);
      if (!row || !client) return [];
      // Layer coordinates = client coordinates + this constant; lineBlockAt is relative to documentTop (client).
      const clientToLayer = row.top - client.top;
      const block = view.lineBlockAt(head);
      const paragraph = { top: view.documentTop + block.top + clientToLayer, bottom: view.documentTop + block.bottom + clientToLayer };
      return veilsFor(paragraph, row).map((b) => new RectangleMarker(VEIL_CLASS, 0, b.top, b.width, b.height));
    },
  });
  return [band, veil];
}
