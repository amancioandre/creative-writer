import { sameTarget } from "../story/Relations";
import type { SceneRef } from "../story/StoryGraph";
import { STOP_ROLES, THREAD_ROLES, type StopRole, type ThreadRef } from "./Thread";

/**
 * Threads the writer draws by hand live in `Story threads.md` in the
 * project folder — a plain note, one `## heading` per thread, one list
 * line per scene it touches:
 *
 *     ## The letter
 *     - [[Chapter 3#The station]] — plant: "she pocketed the letter" Anna pockets it
 *     - [[Chapter 12#Dinner]] — first mentioned aloud
 *     - [[Chapter 41#The reading]] — payoff: "addressed to her mother"
 *
 * After the link and a separator, a line may name the stop's role
 * (`plant:`, `touch:`, `payoff:`, `reversal:`; none means touch) and
 * anchor it to a sentence with one quoted string; whatever is left is
 * the note. Markdown, not JSON, so it reads as an outline, can be edited by hand,
 * syncs everywhere, and Obsidian keeps the links current on rename. The
 * view writes lines here; it never owns them.
 */
export const STORY_THREADS_NOTE = "Story threads.md";
export const STORY_THREADS_FLAG = "creative-writer-threads";
export const STORY_THREADS_VERSION = 1;

export interface WriterThreadItem {
  /** Link target as written, heading included: "Chapter 3#The station". */
  readonly link: string;
  readonly note: string;
  /** 0-based line of the list item. */
  readonly line: number;
  /** `touch` when the line names no role. */
  readonly role: StopRole;
  /** The quoted anchor, without its quotes; null when the line has none. */
  readonly quote: string | null;
}

/** What a stop line says besides its link. */
export interface StopText {
  readonly role?: StopRole;
  readonly quote?: string | null;
}

export interface WriterThread {
  readonly name: string;
  /** 0-based line of the heading. */
  readonly line: number;
  readonly items: readonly WriterThreadItem[];
}

const THREAD_HEADING = /^##\s+(.+?)\s*#*\s*$/;
const ANY_HEADING = /^#{1,6}\s/;
const ITEM = /^\s*[-*+]\s+(.+?)\s*$/;
const LINK = /^\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]\s*(.*)$/;
const MD_LINK = /^\[[^\]]*\]\(([^)]+?)\)\s*(.*)$/;
const SEP = /^(?:[—–:-]|--)\s*/;
const ROLE = new RegExp(`^(${STOP_ROLES.join("|")})\\s*:\\s*`, "i");
const COLUMN_PREFIX = /^(arc|theme|subplot)\s*:\s*(.+)$/i;
const UNKNOWN_PREFIX = /^([a-z][a-z-]{1,15})\s*:\s*\S/i;

/** What a thread column tracks: a character's arc, an argument the book makes, a line of events, or nothing in particular. */
export type ColumnKind = "arc" | "theme" | "subplot" | "free";
export const COLUMN_KINDS: readonly ColumnKind[] = ["arc", "theme", "subplot", "free"];

export interface ColumnHeading {
  readonly kind: ColumnKind;
  /** The heading as written, kind prefix included: the thread's name in the note. */
  readonly heading: string;
  /** What the column is called: the heading without its prefix, and without link brackets. */
  readonly name: string;
  /** An arc heading's `[[link]]` target, or the bare name, so the column can be bound to the character. */
  readonly link: string | null;
  /** A prefix that looks like a kind but is not one ("Arcs:", "Sub-plot:"), so the grid can say so instead of reading a free thread. */
  readonly unknownPrefix: string | null;
}

/**
 * `## Arc: [[Anna]]`, `## Theme: What we owe the dead`, `## Subplot: The letter`;
 * a heading with no prefix is a free thread, so every existing note still parses.
 */
export function parseColumnHeading(heading: string): ColumnHeading {
  const text = heading.trim();
  const m = COLUMN_PREFIX.exec(text);
  if (!m) {
    const u = UNKNOWN_PREFIX.exec(text);
    return { kind: "free", heading: text, name: text, link: null, unknownPrefix: u && !/^https?$/i.test(u[1]!) ? u[1]! : null };
  }
  const kind = m[1]!.toLowerCase() as ColumnKind;
  const rest = m[2]!.trim();
  const wiki = /^\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]$/.exec(rest);
  const name = wiki ? (wiki[2]?.trim() || wiki[1]!.trim()) : rest;
  return { kind, heading: text, name, link: kind === "arc" ? (wiki ? wiki[1]!.trim() : rest) : null, unknownPrefix: null };
}

/** The role words a stop line may open with under this heading: arcs read all eight, other threads only their four. */
export function rolesFor(heading: string): readonly StopRole[] {
  return parseColumnHeading(heading).kind === "arc" ? STOP_ROLES : THREAD_ROLES;
}
const QUOTE = /"([^"]+)"|“([^”]+)”/;

export function parseStoryThreads(markdown: string): WriterThread[] {
  const lines = markdown.split("\n");
  const out: WriterThread[] = [];
  let current: { name: string; line: number; items: WriterThreadItem[] } | null = null;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = THREAD_HEADING.exec(line);
    if (h) { current = { name: h[1]!.trim(), line: i, items: [] }; out.push(current); continue; }
    if (ANY_HEADING.test(line)) { current = null; continue; }
    if (!current) continue;
    const item = ITEM.exec(line);
    if (!item) continue;
    const parsed = parseItem(item[1]!);
    if (parsed) current.items.push({ ...parsed, ...parseStopText(parsed.note, rolesFor(current.name)), line: i });
  }
  return out;
}

/** "[[One#Quay]] — planted" → link "One#Quay", note "planted". Markdown links and bare "One#Quay — planted" also work. */
function parseItem(text: string): { link: string; note: string } | null {
  const wiki = LINK.exec(text);
  if (wiki) return { link: wiki[1]!.trim(), note: wiki[2]!.replace(SEP, "").trim() };
  const md = MD_LINK.exec(text);
  if (md) return { link: safeDecode(md[1]!.replace(/\.md(?=#|$)/i, "").trim()), note: md[2]!.replace(SEP, "").trim() };
  const m = /^(.+?)\s+(?:—|–|--|:)\s*(.*)$/.exec(text);
  if (m) return { link: m[1]!.trim(), note: m[2]!.trim() };
  return text.trim() ? { link: text.trim(), note: "" } : null;
}

/** "plant: \"she pocketed it\" Anna" → role plant, quote "she pocketed it", note "Anna". No role means touch. */
export function parseStopText(text: string, roles: readonly StopRole[] = STOP_ROLES): { role: StopRole; quote: string | null; note: string } {
  let rest = text.trim();
  let role: StopRole = "touch";
  const r = ROLE.exec(rest);
  if (r && roles.includes(r[1]!.toLowerCase() as StopRole)) { role = r[1]!.toLowerCase() as StopRole; rest = rest.slice(r[0].length); }
  let quote: string | null = null;
  const q = QUOTE.exec(rest);
  if (q) { quote = (q[1] ?? q[2] ?? "").trim() || null; rest = (rest.slice(0, q.index) + " " + rest.slice(q.index + q[0].length)); }
  return { role, quote, note: rest.replace(/\s+/g, " ").trim() };
}

/** The line for a stop: link, then the role when it is not the default, the quote, the note. */
export function formatThreadItem(link: string, note: string, stop: StopText = {}): string {
  const target = link.startsWith("[[") || link.startsWith("[") ? link : `[[${link}]]`;
  const parts: string[] = [];
  if (stop.role && stop.role !== "touch") parts.push(`${stop.role}:`);
  if (stop.quote) parts.push(`"${stop.quote.replace(/"/g, "'").trim()}"`);
  if (note.trim()) parts.push(note.trim());
  return parts.length ? `- ${target} — ${parts.join(" ")}` : `- ${target}`;
}

/** Splits "Chapter 3#The station" into its note and heading parts. */
export function splitLink(link: string): { note: string; heading: string } {
  const hash = link.indexOf("#");
  return hash < 0 ? { note: link.trim(), heading: "" } : { note: link.slice(0, hash).trim(), heading: link.slice(hash + 1).trim() };
}

const sameHeading = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/** Two links point at the same scene when their notes share a basename and their headings match, case aside. */
export function sameLink(a: string, b: string): boolean {
  const x = splitLink(linkTarget(a)), y = splitLink(linkTarget(b));
  return sameTarget(x.note, y.note) && sameHeading(x.heading, y.heading);
}

function linkTarget(link: string): string {
  const wiki = LINK.exec(link.trim());
  if (wiki) return wiki[1]!.trim();
  const md = MD_LINK.exec(link.trim());
  return md ? safeDecode(md[1]!.replace(/\.md(?=#|$)/i, "").trim()) : link.trim();
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Adds a stop to a thread, or updates the line that already points at the
 * same scene: the note is replaced, the role and quote only when given.
 * A thread that does not exist yet is started at the end of the note.
 */
export function upsertThreadItem(markdown: string, thread: string, link: string, note: string, stop: StopText = {}): string {
  const lines = markdown.split("\n");
  const existing = parseStoryThreads(markdown).find((t) => sameName(t.name, thread));
  if (existing) {
    const hit = existing.items.find((i) => sameLink(i.link, link));
    // The line already points at that scene: keep the link as the writer wrote it, change only what was given.
    if (hit) { lines[hit.line] = formatThreadItem(hit.link, note, { role: stop.role ?? hit.role, quote: stop.quote === undefined ? hit.quote : stop.quote }); return lines.join("\n"); }
    const end = sectionEnd(lines, existing.line);
    lines.splice(end, 0, formatThreadItem(link, note, stop));
    return lines.join("\n");
  }
  const body = markdown.replace(/\s*$/, "");
  return `${body}${body ? "\n\n" : ""}## ${thread.trim()}\n${formatThreadItem(link, note, stop)}\n`;
}

/** Changes a stop's role, keeping its note and quote; nothing happens when the thread or the stop is not there. */
export function setStopRole(markdown: string, thread: string, link: string, role: StopRole): string {
  const lines = markdown.split("\n");
  const existing = parseStoryThreads(markdown).find((t) => sameName(t.name, thread));
  const hit = existing?.items.find((i) => sameLink(i.link, link));
  if (!hit) return markdown;
  lines[hit.line] = formatThreadItem(hit.link, hit.note, { role, quote: hit.quote });
  return lines.join("\n");
}

/** Appends several stops to one thread in one pass — a motif's occurrences, or a plant and its reversal. */
export function appendThreadItems(markdown: string, thread: string, stops: readonly { link: string; note: string; role?: StopRole; quote?: string | null }[]): string {
  return stops.reduce((md, s) => upsertThreadItem(md, thread, s.link, s.note, { role: s.role, quote: s.quote }), markdown);
}

export function removeThreadItem(markdown: string, thread: string, link: string): string {
  const lines = markdown.split("\n");
  const existing = parseStoryThreads(markdown).find((t) => sameName(t.name, thread));
  const hit = existing?.items.find((i) => sameLink(i.link, link));
  if (!existing || !hit) return markdown;
  lines.splice(hit.line, 1);
  // A thread with no stops left is clutter; take the heading with it.
  const end = sectionEnd(lines, existing.line);
  if (!lines.slice(existing.line + 1, end).some((l) => l.trim())) {
    lines.splice(existing.line, end - existing.line);
    // The blank line that separated the section from what follows is now a stray at the top, or a double.
    if (lines[existing.line]?.trim() === "" && (existing.line === 0 || lines[existing.line - 1]!.trim() === "")) lines.splice(existing.line, 1);
    while (lines.length > 1 && lines[lines.length - 1]!.trim() === "" && lines[lines.length - 2]!.trim() === "") lines.pop();
  }
  return lines.join("\n");
}

/** Starts a thread with no stops yet: a column of the plot grid the writer will fill. Nothing happens when it already exists. */
export function addThread(markdown: string, name: string): string {
  const heading = name.trim();
  if (!heading || parseStoryThreads(markdown).some((t) => sameName(t.name, heading))) return markdown;
  const body = markdown.replace(/\s*$/, "");
  return `${body}${body ? "\n\n" : ""}## ${heading}\n`;
}

/** Takes a thread out whole, heading and stops; the section's trailing blank line goes with it. */
export function removeThread(markdown: string, name: string): string {
  const lines = markdown.split("\n");
  const existing = parseStoryThreads(markdown).find((t) => sameName(t.name, name));
  if (!existing) return markdown;
  const end = sectionEnd(lines, existing.line);
  lines.splice(existing.line, end - existing.line);
  // The blank line that separated the section from what follows is now a stray at the top, or a double.
  if (lines[existing.line]?.trim() === "" && (existing.line === 0 || lines[existing.line - 1]!.trim() === "")) lines.splice(existing.line, 1);
  while (lines.length > 1 && lines[lines.length - 1]!.trim() === "" && lines[lines.length - 2]!.trim() === "") lines.pop();
  return lines.join("\n");
}

export function renameThread(markdown: string, from: string, to: string): string {
  const lines = markdown.split("\n");
  const existing = parseStoryThreads(markdown).find((t) => sameName(t.name, from));
  if (!existing || !to.trim()) return markdown;
  lines[existing.line] = `## ${to.trim()}`;
  return lines.join("\n");
}

/** The line after the section's last item — where a new one goes. */
function sectionEnd(lines: readonly string[], heading: number): number {
  let end = heading + 1;
  while (end < lines.length && !ANY_HEADING.test(lines[end]!)) end++;
  while (end > heading + 1 && lines[end - 1]!.trim() === "") end--;
  return end;
}

/** The note as created the first time the view writes to it: front matter that opts it out of the editor features, and a word of explanation. */
export function serializeStoryThreadsNote(project: string): string {
  return [
    "---",
    "creative-writer: false",
    `${STORY_THREADS_FLAG}: ${STORY_THREADS_VERSION}`,
    "---",
    `Story threads for **${project}** — clues, motifs and set-ups you are tracking by hand. One \`## heading\` per thread, one \`- [[Note#Scene]] — note\` line per scene it touches; a line may start with \`plant:\`, \`payoff:\` or \`reversal:\` and carry one "quoted sentence" as its anchor. The story threads view draws each as arcs across the manuscript and adds lines here when you ask it to; edit freely.`,
    "",
  ].join("\n");
}

/**
 * Turns a written link into a place on the axis. The note part matches
 * by basename (as `## Relationships` links do), the heading case aside;
 * a link with no heading means the note's first scene. What does not
 * resolve is kept as a broken link so the writer can see and fix it.
 */
export function resolveThreadRef(item: WriterThreadItem, scenes: readonly { scene: SceneRef; index: number }[]): ThreadRef {
  const { note, heading } = splitLink(item.link);
  const inNote = scenes.filter((s) => sameTarget(s.scene.path, note));
  const hit = heading ? inNote.find((s) => sameHeading(s.scene.title, heading)) : [...inNote].sort((a, b) => a.index - b.index)[0];
  const stop = { note: item.note, line: item.line, role: item.role, ...(item.quote ? { quote: item.quote } : {}) };
  if (hit) return { scene: hit.scene, index: hit.index, ...stop };
  return { scene: { path: note, title: heading, line: 0 }, index: -1, unresolved: item.link, ...stop };
}

function safeDecode(s: string): string {
  try { return decodeURI(s); } catch { return s; }
}
