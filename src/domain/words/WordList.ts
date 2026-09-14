import { tokenize } from "../style/Tokenizer";
import { PhraseMatcher } from "../style/rules/PhraseMatcher";

/**
 * The writer's own overused words, kept in a note: one heading per category,
 * the words and phrases under it, comma- or line-separated. A `colour: #hex`
 * line under a heading pins that category's colour; otherwise colours
 * follow heading order from the palette.
 *
 *   ## Filtering
 *   felt, saw, heard, noticed
 *
 *   ## Stage direction
 *   colour: #7a4fd6
 *   then, before, and then
 */
export interface WordCategory {
  readonly name: string;
  readonly colour: string | null;
  readonly terms: readonly string[];
}

export const WORD_PALETTE: readonly string[] = ["#9a74ed", "#63b3ed", "#7a4fd6", "#48bbaa", "#ed8936", "#e55353", "#ecc94b", "#3fa66b"];

export function categoryColour(category: WordCategory, index: number): string {
  return category.colour ?? WORD_PALETTE[index % WORD_PALETTE.length]!;
}

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const COLOUR = /^colou?r\s*:\s*(#[0-9a-f]{6})\s*$/i;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const DECOR = /^[*_`~=]+|[*_`~=]+$/g;

export function parseWordLists(markdown: string): WordCategory[] {
  const out: { name: string; colour: string | null; terms: string[] }[] = [];
  const seen = new Set<string>();
  let current: { name: string; colour: string | null; terms: string[] } | null = null;
  const open = (name: string) => { current = { name, colour: null, terms: [] }; out.push(current); return current; };
  for (const raw of markdown.replace(FRONTMATTER, "").split(/\r?\n/)) {
    const line = raw.replace(/^\s*>\s?/, "").trim();
    if (!line || line.startsWith("%%") || line.startsWith("<!--")) continue;
    const heading = HEADING.exec(line);
    if (heading) { open(heading[1]!); continue; }
    const cat = current ?? open("Words");
    const colour = COLOUR.exec(line);
    if (colour) { cat.colour = colour[1]!.toLowerCase(); continue; }
    for (const piece of line.replace(BULLET, "").split(/[,;·]/)) {
      const term = piece.trim().replace(DECOR, "").trim().toLowerCase().replace(/[’ʼ‘]/g, "'");
      if (!term || !/[\p{L}\p{N}]/u.test(term) || seen.has(term)) continue;
      seen.add(term);
      cat.terms.push(term);
    }
  }
  return out.filter((c) => c.terms.length > 0);
}

export interface WordMatch {
  readonly from: number;
  readonly to: number;
  readonly term: string;
  /** Index into the categories the matcher was built from. */
  readonly category: number;
}

/** Whole-word, case-insensitive matching of every term, longest phrase first, never across a sentence boundary. */
export class WordMatcher {
  private readonly matcher: PhraseMatcher<{ term: string; category: number }>;

  constructor(readonly categories: readonly WordCategory[]) {
    const entries: [string, { term: string; category: number }][] = [];
    categories.forEach((c, category) => { for (const term of c.terms) entries.push([term, { term, category }]); });
    this.matcher = new PhraseMatcher(entries);
  }

  get empty(): boolean {
    return this.categories.every((c) => c.terms.length === 0);
  }

  findAll(text: string): WordMatch[] {
    if (this.empty) return [];
    return this.matcher.findAll(tokenize(text)).map((m) => ({ from: m.from, to: m.to, term: m.value.term, category: m.value.category }));
  }
}
