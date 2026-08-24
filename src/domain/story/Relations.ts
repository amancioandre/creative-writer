/**
 * Relationships the writer draws by hand live in the entity's own note,
 * under a `## Relationships` heading, one list line each:
 *
 *     ## Relationships
 *     - [[Ilse]] — sister
 *     - [[The Guild]] — sworn enemy
 *
 * Markdown, not front matter, so it reads as prose, syncs everywhere,
 * and Obsidian keeps the links current when a note is renamed.
 */
export const RELATIONS_HEADING = "Relationships";

export interface AuthoredRelation {
  /** Link target as written — "Ilse", "Characters/Ilse", never the alias part. */
  readonly target: string;
  readonly label: string;
  /** 0-based line of the list item. */
  readonly line: number;
}

const HEADING = /^#{1,6}\s+(relationships?|relations)\s*$/i;
const ANY_HEADING = /^#{1,6}\s/;
const ITEM = /^\s*[-*+]\s+(.+?)\s*$/;
const LINK = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]\s*(.*)$/;
/** `[Ilse](Characters/Ilse.md)` — what a vault set to markdown links writes. */
const MD_LINK = /^\[[^\]]*\]\(([^)]+?)(?:\.md)?\)\s*(.*)$/;
const SEP = /^(?:[—–:-]|--)\s*/;

export function parseRelations(markdown: string): AuthoredRelation[] {
  const lines = markdown.split("\n");
  const out: AuthoredRelation[] = [];
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (HEADING.test(line)) { inSection = true; continue; }
    if (inSection && ANY_HEADING.test(line)) { inSection = false; continue; }
    if (!inSection) continue;
    const item = ITEM.exec(line);
    if (!item) continue;
    const parsed = parseItem(item[1]!);
    if (parsed) out.push({ ...parsed, line: i });
  }
  return out;
}

/** "[[Ilse]] — sister" → target "Ilse", label "sister". Bare "Ilse — sister" also works. */
function parseItem(text: string): { target: string; label: string } | null {
  const link = LINK.exec(text);
  if (link) return { target: link[1]!.trim(), label: link[2]!.replace(SEP, "").trim() };
  const md = MD_LINK.exec(text);
  if (md) return { target: safeDecode(md[1]!.split("#")[0]!.trim()), label: md[2]!.replace(SEP, "").trim() };
  const m = /^(.+?)\s+(?:—|–|--|:)\s*(.*)$/.exec(text);
  if (m) return { target: m[1]!.trim(), label: m[2]!.trim() };
  return text.trim() ? { target: text.trim(), label: "" } : null;
}

export function formatRelation(link: string, label: string): string {
  return label ? `- ${link} — ${label}` : `- ${link}`;
}

/**
 * Adds a relation line, or relabels the existing line for the same target
 * (matched by `previousLabel` when given, otherwise the first line for that
 * target). `link` is the wikilink text to write, e.g. "[[Ilse]]".
 */
export function upsertRelation(markdown: string, link: string, label: string, previousLabel?: string): string {
  const target = linkTarget(link);
  const lines = markdown.split("\n");
  const existing = parseRelations(markdown).filter((r) => sameTarget(r.target, target));
  const hit = previousLabel === undefined ? existing[0] : existing.find((r) => r.label === previousLabel) ?? existing[0];
  if (hit) {
    lines[hit.line] = formatRelation(link, label);
    return lines.join("\n");
  }
  const section = findSection(lines);
  if (section) {
    lines.splice(section.end, 0, formatRelation(link, label));
    return lines.join("\n");
  }
  const body = markdown.replace(/\s*$/, "");
  return `${body}${body ? "\n\n" : ""}## ${RELATIONS_HEADING}\n${formatRelation(link, label)}\n`;
}

export function removeRelation(markdown: string, target: string, label: string): string {
  const lines = markdown.split("\n");
  const hit = parseRelations(markdown).find((r) => sameTarget(r.target, linkTarget(target)) && r.label === label);
  if (!hit) return markdown;
  lines.splice(hit.line, 1);
  // A section left with no items is just clutter.
  const section = findSection(lines);
  if (section && !lines.slice(section.start + 1, section.end).some((l) => l.trim())) {
    lines.splice(section.start, section.end - section.start);
    while (lines.length && lines[lines.length - 1]!.trim() === "" && lines.length > 1 && lines[lines.length - 2]!.trim() === "") lines.pop();
  }
  return lines.join("\n");
}

/** The section's heading line and the line after its last item (where a new item goes). */
function findSection(lines: readonly string[]): { start: number; end: number } | null {
  const start = lines.findIndex((l) => HEADING.test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !ANY_HEADING.test(lines[end]!)) end++;
  while (end > start + 1 && lines[end - 1]!.trim() === "") end--;
  return { start, end };
}

export function linkTarget(link: string): string {
  const wiki = LINK.exec(link.trim());
  if (wiki) return wiki[1]!.trim();
  const md = MD_LINK.exec(link.trim());
  return md ? safeDecode(md[1]!.split("#")[0]!.trim()) : link.trim();
}

function safeDecode(s: string): string {
  try { return decodeURI(s); } catch { return s; }
}

/** "Characters/Ilse" and "Ilse" name the same note when the shorter is the other's basename. */
export function sameTarget(a: string, b: string): boolean {
  const base = (s: string) => s.slice(s.lastIndexOf("/") + 1).replace(/\.md$/i, "").toLowerCase();
  return base(a) === base(b);
}
