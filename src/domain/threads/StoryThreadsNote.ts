import { sameTarget } from "../story/Relations";
import type { SceneRef } from "../story/StoryGraph";
import type { ThreadRef } from "./Thread";

/**
 * Threads the writer draws by hand live in `Story threads.md` in the
 * project folder — a plain note, one `## heading` per thread, one list
 * line per scene it touches:
 *
 *     ## The letter
 *     - [[Chapter 3#The station]] — Anna pockets it
 *     - [[Chapter 12#Dinner]] — first mentioned aloud
 *     - [[Chapter 41#The reading]] — payoff
 *
 * Markdown, not JSON, so it reads as an outline, can be edited by hand,
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
    if (parsed) current.items.push({ ...parsed, line: i });
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

export function formatThreadItem(link: string, note: string): string {
  const target = link.startsWith("[[") || link.startsWith("[") ? link : `[[${link}]]`;
  return note ? `- ${target} — ${note}` : `- ${target}`;
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
 * Adds a stop to a thread, or updates the note on the line that already
 * points at the same scene. A thread that does not exist yet is started
 * at the end of the note.
 */
export function upsertThreadItem(markdown: string, thread: string, link: string, note: string): string {
  const lines = markdown.split("\n");
  const existing = parseStoryThreads(markdown).find((t) => sameName(t.name, thread));
  if (existing) {
    const hit = existing.items.find((i) => sameLink(i.link, link));
    // The line already points at that scene: keep the link as the writer wrote it, change only the note.
    if (hit) { lines[hit.line] = formatThreadItem(hit.link, note); return lines.join("\n"); }
    const end = sectionEnd(lines, existing.line);
    lines.splice(end, 0, formatThreadItem(link, note));
    return lines.join("\n");
  }
  const body = markdown.replace(/\s*$/, "");
  return `${body}${body ? "\n\n" : ""}## ${thread.trim()}\n${formatThreadItem(link, note)}\n`;
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
    `Story threads for **${project}** — clues, motifs and set-ups you are tracking by hand. One \`## heading\` per thread, one \`- [[Note#Scene]] — note\` line per scene it touches. The story threads view draws each as arcs across the manuscript and adds lines here when you ask it to; edit freely.`,
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
  if (hit) return { scene: hit.scene, index: hit.index, note: item.note, line: item.line };
  return { scene: { path: note, title: heading, line: 0 }, index: -1, note: item.note, unresolved: item.link, line: item.line };
}

function safeDecode(s: string): string {
  try { return decodeURI(s); } catch { return s; }
}
