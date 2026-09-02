/**
 * A story *uses* a card when a note of the project links to it: a plain
 * `[[wikilink]]`, or a `%% REF: [[Card]] %%` comment. The REF form exists
 * so a reference can sit in prose and still be hidden from the manuscript
 * page and any export, because comments never reach the reader. REFs are
 * never written by the plugin on its own.
 *
 * A card used by two or more stories is *recurring*: the simplest picture
 * of what the writer keeps returning to.
 */
export const REF_TAG = "REF";

/** `%% REF: [[Note]] %%`, `%% REF: [[Note#Heading|shown]] %%`; the link target as written, before any resolution. */
const REF_COMMENT = /%%\s*REF:\s*\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]\s*%%/g;

export function refLinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(REF_COMMENT)) {
    const target = m[1]!.trim();
    if (target && !out.includes(target)) out.push(target);
  }
  return out;
}

export interface StoryNote {
  readonly path: string;
  /** Resolved paths the note links to, comments included (Obsidian's cache reads links inside comments too). */
  readonly links: readonly string[];
  readonly text: string;
}

export interface Story {
  readonly name: string;
  readonly notes: readonly StoryNote[];
}

export type Uses = ReadonlyMap<string, readonly string[]>;

/**
 * Card path to the names of the stories that use it, in story order, each once.
 * `resolve` turns a link as written into a path, or null when it points nowhere.
 */
export function usesOf(cardPaths: Iterable<string>, stories: readonly Story[], resolve: (link: string, fromPath: string) => string | null): Uses {
  const cards = new Set(cardPaths);
  const uses = new Map<string, string[]>();
  for (const story of stories) {
    const hit = new Set<string>();
    for (const note of story.notes) {
      for (const p of note.links) if (cards.has(p)) hit.add(p);
      for (const link of refLinks(note.text)) {
        const p = resolve(link, note.path);
        if (p && cards.has(p)) hit.add(p);
      }
    }
    for (const p of hit) {
      const list = uses.get(p) ?? [];
      if (!list.includes(story.name)) list.push(story.name);
      uses.set(p, list);
    }
  }
  return uses;
}

export function isRecurring(uses: Uses, path: string): boolean {
  return (uses.get(path)?.length ?? 0) >= 2;
}
