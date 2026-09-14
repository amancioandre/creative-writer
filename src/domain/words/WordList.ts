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

/** The note with `term` added under `category`: on the category's last term line, or as a new heading at the end. */
export function addTerm(markdown: string, category: string, term: string): string {
  const t = term.trim();
  if (!t) return markdown;
  const lines = markdown.split(/\r?\n/);
  let inCategory = false;
  let lastTermLine = -1;
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const heading = HEADING.exec(line);
    if (heading) { if (inCategory) break; inCategory = heading[1]!.trim().toLowerCase() === category.trim().toLowerCase(); if (inCategory) found = true; continue; }
    if (!inCategory || !line || COLOUR.test(line) || line.startsWith("%%") || line.startsWith("<!--")) continue;
    lastTermLine = i;
  }
  if (!found) {
    const tail = markdown.endsWith("\n") || markdown === "" ? "" : "\n";
    return `${markdown}${tail}${markdown.trim() ? "\n" : ""}## ${category.trim()}\n${t}\n`;
  }
  if (lastTermLine < 0) {
    // A heading with nothing under it yet: the term goes right after it.
    const at = lines.findIndex((l) => { const h = HEADING.exec(l.trim()); return !!h && h[1]!.trim().toLowerCase() === category.trim().toLowerCase(); });
    lines.splice(at + 1, 0, t);
    return lines.join("\n");
  }
  lines[lastTermLine] = `${lines[lastTermLine]!.replace(/[\s,;]+$/, "")}, ${t}`;
  return lines.join("\n");
}

/** The note without `term`, wherever it stands; a line left empty by that goes too. */
export function removeTerm(markdown: string, term: string): string {
  const key = term.trim().toLowerCase().replace(/[’ʼ‘]/g, "'");
  if (!key) return markdown;
  const same = (piece: string) => piece.trim().replace(DECOR, "").trim().toLowerCase().replace(/[’ʼ‘]/g, "'") === key;
  const out: string[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || HEADING.test(line) || COLOUR.test(line) || line.startsWith("%%") || line.startsWith("<!--")) { out.push(raw); continue; }
    const bullet = raw.match(BULLET)?.[0] ?? "";
    const pieces = raw.replace(BULLET, "").split(/[,;·]/);
    if (!pieces.some(same)) { out.push(raw); continue; }
    const kept = pieces.filter((p) => !same(p)).map((p) => p.trim()).filter(Boolean);
    if (kept.length) out.push(`${bullet}${kept.join(", ")}`);
  }
  return out.join("\n");
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
