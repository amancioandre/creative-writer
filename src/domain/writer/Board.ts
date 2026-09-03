import { type Framework, type GroupDef, UNSORTED, groupsOf } from "./Framework";
import { groupsFromTags } from "./Tags";
import type { ReadingStatus } from "./Stories";
import { type NamedEdge, type Point, type Rect, type WriterFile, colourOf, resolveFramework } from "./WriterFile";

/** A note as the board reads it: path, title, its tags, the notes it links to, an excerpt for the hover card. */
export interface WriterNote {
  readonly path: string;
  readonly title: string;
  readonly tags: readonly string[];
  /** Resolved paths of the notes this one links to. */
  readonly links: readonly string[];
  /** The first paragraph of prose, trimmed. */
  readonly excerpt: string;
  /** Resolved path of the note's `writer-story` link: the project an idea became. Null for most notes. */
  readonly story?: string | null;
  /** The note's `reading:` status, for reading-list cards. */
  readonly reading?: ReadingStatus | null;
}

/** A note on the board. The same card appears in every group its tags name. */
export interface Card {
  readonly path: string;
  readonly title: string;
  /** The project note this idea became, when it did. */
  readonly story: string | null;
  /** Reading-list status, when the note carries one. */
  readonly reading: ReadingStatus | null;
  /** The groups it is shown in: its tags' groups, unknown ones folded to Unsorted. */
  readonly groups: readonly string[];
  /** The tags' groups as written, one per entry of `groups`, so a tag can be rewritten from what it is. */
  readonly tagGroups: readonly string[];
  readonly excerpt: string;
  /** Hand-placed; null until the writer moves it. */
  readonly position: Point | null;
}

export interface BoardGroup {
  readonly def: GroupDef;
  readonly colour: string;
  readonly rect: Rect | null;
  readonly cards: readonly Card[];
}

export interface BoardLayer {
  readonly name: string;
  readonly groups: readonly BoardGroup[];
}

/** Two cards whose notes link. Undirected, one per pair. */
export interface DerivedEdge {
  readonly from: string;
  readonly to: string;
}

/** A named edge with whether its underlying link still exists; a stale one is drawn dashed and offered for removal. */
export interface BoardEdge extends NamedEdge {
  readonly linked: boolean;
}

export interface Board {
  readonly framework: Framework;
  readonly prefix: string;
  readonly layers: readonly BoardLayer[];
  /** Cards whose tag suffix matches no group; shown so nothing is lost when frameworks change. */
  readonly unsorted: BoardGroup;
  /** Every card once, by title. */
  readonly cards: readonly Card[];
  readonly derived: readonly DerivedEdge[];
  readonly named: readonly BoardEdge[];
}

const pairKey = (a: string, b: string) => [a, b].sort().join(" ");

export const EMPTY_BOARD: Board = buildBoard([], { version: 1, framework: "truby", prefix: "writer", colours: {}, groups: {}, cards: {}, edges: [], view: null });

/**
 * The board from the vault's tagged notes and the writer file. Pure: the
 * same notes and file give the same board on every machine.
 */
export function buildBoard(notes: readonly WriterNote[], file: WriterFile): Board {
  const framework = resolveFramework(file);
  const known = new Set(groupsOf(framework).map((g) => g.id));
  const cards: Card[] = [];
  for (const n of notes) {
    const tagged = groupsFromTags(n.tags, file.prefix);
    if (!tagged.length) continue;
    const groups: string[] = [], tagGroups: string[] = [];
    for (const g of tagged) {
      const shown = known.has(g) ? g : UNSORTED.id;
      if (groups.includes(shown)) continue;
      groups.push(shown); tagGroups.push(g);
    }
    cards.push({ path: n.path, title: n.title, story: n.story ?? null, reading: n.reading ?? null, groups, tagGroups, excerpt: n.excerpt, position: file.cards[n.path] ?? null });
  }
  cards.sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
  const byPath = new Map(cards.map((c) => [c.path, c]));

  const group = (def: GroupDef): BoardGroup => ({ def, colour: colourOf(file, def), rect: file.groups[def.id] ?? null, cards: cards.filter((c) => c.groups.includes(def.id)) });
  const layers = framework.layers.map((l) => ({ name: l.name, groups: l.groups.map(group) }));
  const unsorted = group(UNSORTED);

  const pairs = new Set<string>();
  const derived: DerivedEdge[] = [];
  for (const n of notes) {
    if (!byPath.has(n.path)) continue;
    for (const to of n.links) {
      if (to === n.path || !byPath.has(to)) continue;
      const key = pairKey(n.path, to);
      if (pairs.has(key)) continue;
      pairs.add(key);
      derived.push({ from: n.path, to });
    }
  }
  const named = file.edges.filter((e) => byPath.has(e.from) && byPath.has(e.to)).map((e) => ({ ...e, linked: pairs.has(pairKey(e.from, e.to)) }));
  return { framework, prefix: file.prefix, layers, unsorted, cards, derived, named };
}
