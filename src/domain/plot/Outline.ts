import { commentLine, htmlComment, stripComments, type CommentState } from "../text/Comments";

/**
 * The paper grid: scenes, chapters and acts planned in the plot grid
 * before any chapter note exists. One markdown note in the project
 * folder, `Outline.md`, written by the grid's row actions and free to
 * edit by hand:
 *
 *     # Act I
 *     ## The perfect record
 *     ### 1 Gainesville courtroom
 *     <!-- Kevin wins a case he knows he should lose -->
 *     ### 4 The recess bathroom
 *
 * `#` is an act, `##` a chapter, `###` a scene, and the comment under a
 * scene its logline, in the HTML form so the note reads clean anywhere.
 * The grid draws each scene as an outline row until **Build the
 * manuscript** turns the note into folders and chapter notes; the note is
 * kept afterwards, marked built, and read no more.
 */
export const OUTLINE_NOTE = "Outline.md";
export const OUTLINE_FLAG = "creative-writer-outline";
export const OUTLINE_BUILT_KEY = "creative-writer-outline-built";
export const OUTLINE_VERSION = 1;

export interface OutlineScene {
  readonly title: string;
  /** 0-based line of the heading. */
  readonly line: number;
  /** The comment under the heading, if any; a `beat:` comment is not it. */
  readonly logline: string;
  /** Beats the scene carries, from `<!-- beat: … -->` lines under its heading: a template's shape, kept apart from the writer's own line. */
  readonly beats: readonly string[];
}

export interface OutlineChapter {
  readonly title: string;
  /** 0-based line of the heading; -1 for scenes written above any chapter. */
  readonly line: number;
  readonly scenes: readonly OutlineScene[];
}

export interface OutlineAct {
  readonly title: string;
  /** 0-based line of the heading; -1 for chapters written above any act. */
  readonly line: number;
  readonly chapters: readonly OutlineChapter[];
}

export interface Outline {
  readonly acts: readonly OutlineAct[];
  /** Whether the note carries the outline flag: only then is it the grid's plan, since a note called Outline without it is a chapter like any other. */
  readonly flagged: boolean;
  /** The day the outline was built into notes, from the front matter; null while it is still the plan. */
  readonly built: string | null;
  readonly scenes: number;
  readonly chapters: number;
}

export const EMPTY_OUTLINE: Outline = { acts: [], flagged: false, built: null, scenes: 0, chapters: 0 };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

/** Where the front matter ends: the first body line. */
function bodyStart(lines: readonly string[]): number {
  if (lines[0] !== "---") return 0;
  const end = lines.indexOf("---", 1);
  return end > 0 ? end + 1 : 0;
}

function frontMatterValue(lines: readonly string[], key: string): string | null {
  const end = bodyStart(lines);
  for (const line of lines.slice(1, Math.max(0, end - 1))) {
    const m = /^([^:]+):\s*(.*?)\s*$/.exec(line);
    if (m && m[1]!.trim() === key) return m[2]!.replace(/^["']|["']$/g, "");
  }
  return null;
}

/** Every heading of the body with its level, comments and fences respected. */
function headings(lines: readonly string[]): { title: string; level: number; line: number }[] {
  const out: { title: string; level: number; line: number }[] = [];
  let inFence = false;
  let comment: CommentState = null;
  for (let i = bodyStart(lines); i < lines.length; i++) {
    const raw = lines[i]!;
    if (FENCE.test(raw)) inFence = !inFence;
    if (inFence) continue;
    const stripped = stripComments(raw, comment);
    comment = stripped.state;
    const m = HEADING.exec(stripped.text);
    if (m) out.push({ title: m[2]!, level: m[1]!.length, line: i });
  }
  return out;
}

export function parseOutline(markdown: string): Outline {
  const lines = markdown.split("\n");
  const built = frontMatterValue(lines, OUTLINE_BUILT_KEY);
  const flagged = frontMatterValue(lines, OUTLINE_FLAG) !== null;
  const acts: { title: string; line: number; chapters: { title: string; line: number; scenes: OutlineScene[] }[] }[] = [];
  let act: (typeof acts)[number] | null = null;
  let chapter: (typeof acts)[number]["chapters"][number] | null = null;
  const openAct = (title: string, line: number) => { act = { title, line, chapters: [] }; acts.push(act); chapter = null; };
  const openChapter = (title: string, line: number) => { if (!act) openAct("", -1); chapter = { title, line, scenes: [] }; act!.chapters.push(chapter); };
  for (const h of headings(lines)) {
    if (h.level === 1) openAct(h.title, h.line);
    else if (h.level === 2) openChapter(h.title, h.line);
    else {
      if (!chapter) openChapter("", -1);
      chapter!.scenes.push({ title: h.title, line: h.line, logline: loglineAt(lines, h.line), beats: beatsAt(lines, h.line) });
    }
  }
  const chapters = acts.reduce((n, a) => n + a.chapters.length, 0);
  const scenes = acts.reduce((n, a) => n + a.chapters.reduce((m, c) => m + c.scenes.length, 0), 0);
  return { acts, flagged, built: built?.trim() || null, scenes, chapters };
}

const BEAT = /^beat\s*:\s*(.+)$/i;

/** The comment lines directly under a heading, blank lines aside, until anything that is not a comment. */
function commentsUnder(lines: readonly string[], heading: number): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  for (let i = heading + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const text = commentLine(line);
    if (text === null) break;
    out.push({ line: i, text });
  }
  return out;
}

/** The first comment under a heading that is not a beat: the writer's line about the scene. */
function loglineAt(lines: readonly string[], heading: number): string {
  return commentsUnder(lines, heading).find((c) => !BEAT.test(c.text))?.text ?? "";
}

function loglineLine(lines: readonly string[], heading: number): number | null {
  return commentsUnder(lines, heading).find((c) => !BEAT.test(c.text))?.line ?? null;
}

function beatsAt(lines: readonly string[], heading: number): string[] {
  return commentsUnder(lines, heading).map((c) => BEAT.exec(c.text)?.[1]?.trim() ?? "").filter(Boolean);
}

/** The line a template writes to tag a scene with a beat. */
export function beatComment(beat: string): string {
  return htmlComment(`beat: ${beat}`);
}

/** Appends a structure written in the outline's grammar (a template's acts, chapters and scenes) after what the note already holds. */
export function appendOutline(markdown: string, structure: string): string {
  const text = structure.replace(/^\s+|\s+$/g, "");
  if (!text) return markdown;
  const body = markdown.replace(/\s*$/, "");
  return `${body}${body ? "\n\n" : ""}${text}\n`;
}

/** The first line after a heading's block: the next heading of the same or a higher level, or the end. */
function blockEnd(lines: readonly string[], heading: number): number {
  const level = HEADING.exec(lines[heading]!)?.[1]?.length ?? 6;
  let end = heading + 1;
  while (end < lines.length) {
    const m = HEADING.exec(lines[end]!);
    if (m && m[1]!.length <= level) break;
    end++;
  }
  return end;
}

/** A section as lines, ready to move or remove: its heading through its last non-blank line. */
function block(lines: readonly string[], heading: number): { from: number; to: number } {
  let to = blockEnd(lines, heading);
  while (to > heading + 1 && lines[to - 1]!.trim() === "") to--;
  return { from: heading, to };
}

function levelOf(lines: readonly string[], line: number): number { return HEADING.exec(lines[line] ?? "")?.[1]?.length ?? 0; }

const NEW_SCENE = "New scene";
const NEW_CHAPTER = "New chapter";
const NEW_ACT = "New act";

/**
 * A scene after another scene, or at the end of a chapter (`after` is a
 * scene's or a chapter's heading line). With nothing to go after, the
 * scene joins the last chapter, and a note with no chapter gets one.
 */
export function insertScene(markdown: string, after: number | null, title = NEW_SCENE, logline = ""): string {
  const lines = markdown.split("\n");
  const outline = parseOutline(markdown);
  const text = [`### ${title.trim() || NEW_SCENE}`, ...(logline.trim() ? [htmlComment(logline)] : [])];
  if (after !== null && levelOf(lines, after) >= 2) {
    lines.splice(block(lines, after).to, 0, ...text);
    return lines.join("\n");
  }
  const last = outline.acts.at(-1)?.chapters.at(-1);
  if (last && last.line >= 0) { lines.splice(block(lines, last.line).to, 0, ...text); return lines.join("\n"); }
  return append(markdown, last ? text : [`## Chapter 1`, ...text]);
}

/** A chapter after another chapter (`after` a chapter's heading line), else at the end of the last act, with one scene so the grid has a row for it. */
export function insertChapter(markdown: string, after: number | null, title = NEW_CHAPTER, scene = NEW_SCENE): string {
  const lines = markdown.split("\n");
  const text = [`## ${title.trim() || NEW_CHAPTER}`, `### ${scene.trim() || NEW_SCENE}`];
  if (after !== null && levelOf(lines, after) === 2) { lines.splice(block(lines, after).to, 0, "", ...text); return lines.join("\n"); }
  return append(markdown, text);
}

/** An act at the end of the note, with a chapter and a scene in it. */
export function insertAct(markdown: string, title = NEW_ACT, chapter = NEW_CHAPTER, scene = NEW_SCENE): string {
  return append(markdown, [`# ${title.trim() || NEW_ACT}`, `## ${chapter.trim() || NEW_CHAPTER}`, `### ${scene.trim() || NEW_SCENE}`]);
}

function append(markdown: string, text: readonly string[]): string {
  const body = markdown.replace(/\s*$/, "");
  return `${body}${body ? "\n\n" : ""}${text.join("\n")}\n`;
}

export function renameHeading(markdown: string, line: number, title: string): string {
  const lines = markdown.split("\n");
  const m = HEADING.exec(lines[line] ?? "");
  if (!m || !title.trim()) return markdown;
  lines[line] = `${m[1]} ${title.trim()}`;
  return lines.join("\n");
}

/** Writes, replaces or (with an empty text) removes the logline under a scene heading. */
export function setLogline(markdown: string, line: number, text: string): string {
  const lines = markdown.split("\n");
  if (!HEADING.test(lines[line] ?? "")) return markdown;
  const at = loglineLine(lines, line);
  const clean = text.trim();
  if (at !== null) { if (clean) lines[at] = htmlComment(clean); else lines.splice(at, 1); }
  // A new logline goes right under the heading, above any beat tags, so it is the first thing a reader sees.
  else if (clean) lines.splice(line + 1, 0, htmlComment(clean));
  return lines.join("\n");
}

/** Swaps a section with its previous or next sibling of the same level; nothing happens at either end. */
export function moveHeading(markdown: string, line: number, direction: -1 | 1): string {
  const lines = markdown.split("\n");
  const level = levelOf(lines, line);
  if (!level) return markdown;
  const siblings = headings(lines).filter((h) => h.level === level && parentOf(lines, h.line, level) === parentOf(lines, line, level)).map((h) => h.line);
  const i = siblings.indexOf(line);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= siblings.length) return markdown;
  const a = block(lines, Math.min(line, siblings[j]!)), b = block(lines, Math.max(line, siblings[j]!));
  const between = lines.slice(a.to, b.from);
  const out = [...lines.slice(0, a.from), ...lines.slice(b.from, b.to), ...between, ...lines.slice(a.from, a.to), ...lines.slice(b.to)];
  return out.join("\n");
}

/** The nearest heading above of a higher level: which chapter a scene is in, which act a chapter is in. */
function parentOf(lines: readonly string[], line: number, level: number): number {
  for (let i = line - 1; i >= 0; i--) { const l = levelOf(lines, i); if (l && l < level) return i; }
  return -1;
}

/** Takes a section out whole: a scene with its logline, a chapter with its scenes, an act with its chapters. */
export function removeHeading(markdown: string, line: number): string {
  const lines = markdown.split("\n");
  if (!levelOf(lines, line)) return markdown;
  const { from } = block(lines, line);
  const to = blockEnd(lines, line);
  lines.splice(from, to - from);
  while (from > 0 && from < lines.length && lines[from]!.trim() === "" && lines[from - 1]!.trim() === "") lines.splice(from, 1);
  return lines.join("\n").replace(/\n{3,}$/, "\n\n");
}

/** Records the build day in the front matter; a note without front matter gets the block. */
export function markBuilt(markdown: string, day: string | null): string {
  const lines = markdown.split("\n");
  const end = bodyStart(lines);
  const key = `${OUTLINE_BUILT_KEY}: ${day ?? ""}`;
  if (end === 0) return day ? `---\n${key}\n---\n${markdown}` : markdown;
  const at = lines.findIndex((l, i) => i > 0 && i < end - 1 && l.startsWith(`${OUTLINE_BUILT_KEY}:`));
  if (at >= 0) { if (day) lines[at] = key; else lines.splice(at, 1); }
  else if (day) lines.splice(end - 1, 0, key);
  return lines.join("\n");
}

/** The note as the grid creates it on the first row: front matter that keeps it out of the map and the editor features, and a word of explanation. */
export function serializeOutlineNote(project: string): string {
  return [
    "---",
    "creative-writer: false",
    `${OUTLINE_FLAG}: ${OUTLINE_VERSION}`,
    "---",
    `The outline of **${project}**, written from the plot grid before the chapters exist. \`#\` is an act, \`##\` a chapter, \`###\` a scene, and a comment under a scene its logline. Edit freely; the grid reads it back. **Build the manuscript** in the grid turns it into folders and chapter notes and keeps this note as the record.`,
    "",
  ].join("\n");
}
