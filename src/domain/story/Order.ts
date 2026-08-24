/**
 * Manuscript order. Every story view — map, timeline, threads — needs
 * scenes in the order a reader meets them, and "earlier" and "later" only
 * mean something when that order is settled. By default notes sort by
 * path, which works as long as chapters are numbered in their filenames.
 * A note can also say where it belongs:
 *
 *     story-order: 3
 *
 * Ordered notes come first, by number; the rest follow in path order.
 * Scenes inside a note are always in document order.
 */
export interface OrderedNote {
  readonly path: string;
  readonly frontmatter: unknown;
}

export const STORY_ORDER_KEY = "story-order";

/** The `story-order` number, if the note has a usable one. */
export function storyOrderOf(frontmatter: unknown): number | null {
  const fm = (frontmatter && typeof frontmatter === "object" ? frontmatter : {}) as Record<string, unknown>;
  const raw = fm[STORY_ORDER_KEY];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim() && !Number.isNaN(Number(raw))) return Number(raw);
  return null;
}

export function compareNotes(a: OrderedNote, b: OrderedNote): number {
  const oa = storyOrderOf(a.frontmatter), ob = storyOrderOf(b.frontmatter);
  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;
  return a.path.localeCompare(b.path);
}
