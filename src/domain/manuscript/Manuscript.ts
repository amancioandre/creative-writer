import { compareNotes } from "../story/Order";
import { basenameOf, entityKindOf } from "../story/EntityIndex";
import { STORY_MAP_NOTE } from "../story/StoryMapFile";
import { STORY_THREADS_NOTE } from "../threads/StoryThreadsNote";
import { countWords } from "../text/Dialogue";
import { PROSE_KINDS, splitBlocks, type SourceBlock } from "./Blocks";
import { findAnnotations, stripComments, type Annotation } from "./Comments";

/**
 * The manuscript: every prose note of a project stitched into one document
 * in reading order, with the folder tree as its outline. Folders become
 * headings, note names become headings under them, and the headings inside
 * a note sit under those — so `Part One/Chapter Three.md` with a `# Camp`
 * scene reads as Part One › Chapter Three › Camp.
 *
 * Only the story is in: typed notes (characters, places…), the plugin's
 * own data notes, notes with `manuscript: false` and notes with no prose
 * at all stay out. Nothing here is persisted; it is a pure function of the
 * notes, rebuilt on every change.
 */
export interface ManuscriptNote {
  readonly path: string;
  readonly frontmatter: unknown;
  readonly text: string;
}

export interface ManuscriptOptions {
  /** How many folder levels below the project folder become headings; 0 = none. */
  readonly folderDepth: number;
  /** Whether a note's name becomes a heading above its content. */
  readonly noteTitles: boolean;
  /** A regular expression (source) stripped from the start of folder and note names: sort prefixes like `01 - `. */
  readonly stripPrefix: string;
  /** Push a note's own headings down below the generated ones, so `# Camp` inside a chapter is not a sibling of the part. */
  readonly demoteHeadings: boolean;
  /** Drop everything that is not paragraph, heading, quote or scene break. */
  readonly proseOnly: boolean;
}

export const MANUSCRIPT_KEY = "manuscript";

export interface ManuscriptBlock extends SourceBlock {
  /** The level this heading renders at after demotion; 0 for non-headings. */
  readonly level: number;
  /**
   * The comments and highlights that belong to this block: those inside it,
   * and those in whole-block comments or dropped blocks that follow it — a
   * `%% … %%` on its own line is about the paragraph before it.
   */
  readonly annotations: readonly Annotation[];
}

export interface FolderItem {
  readonly kind: "folder";
  readonly level: number;
  readonly title: string;
  /** Vault-relative folder path with a trailing slash. */
  readonly folder: string;
}

export interface NoteItem {
  readonly kind: "note";
  readonly level: number;
  readonly title: string;
  readonly path: string;
  /** False when the note's name is hidden by settings or already its first heading. */
  readonly showTitle: boolean;
  readonly blocks: readonly ManuscriptBlock[];
  readonly words: number;
  /** The note's comments and highlights, in document order. */
  readonly annotations: readonly Annotation[];
}

export type ManuscriptItem = FolderItem | NoteItem;

export interface Manuscript {
  readonly items: readonly ManuscriptItem[];
  readonly notes: number;
  readonly words: number;
}

export const EMPTY_MANUSCRIPT: Manuscript = { items: [], notes: 0, words: 0 };

/** The default prefix pattern: a number and whatever separates it from the name — `01 `, `3. `, `02 - `, `1) `. */
export const DEFAULT_STRIP_PREFIX = "^\\d+[\\s._)-]*";

/** Compiles the writer's pattern; an invalid one strips nothing rather than breaking the view. */
export function prefixPattern(source: string): RegExp | null {
  if (!source.trim()) return null;
  try { return new RegExp(source, "u"); } catch { return null; }
}

export function displayTitle(name: string, strip: RegExp | null): string {
  const t = strip ? name.replace(strip, "") : name;
  return t.trim() || name.trim();
}

/** Front matter `manuscript: false` (or a string spelling of it) keeps a note out. */
export function manuscriptFlag(frontmatter: unknown): boolean | null {
  const fm = (frontmatter && typeof frontmatter === "object" ? frontmatter : {}) as Record<string, unknown>;
  const v = fm[MANUSCRIPT_KEY];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "yes") return true;
    if (s === "false" || s === "no") return false;
  }
  return null;
}

/**
 * Whether a note is part of the manuscript: not an entity, not a data note,
 * not opted out. `manuscript: true` lets a typed note in regardless.
 */
export function isManuscriptNote(note: { path: string; frontmatter: unknown }): boolean {
  const flag = manuscriptFlag(note.frontmatter);
  if (flag !== null) return flag;
  const base = basenameOf(note.path) + ".md";
  if (base === STORY_MAP_NOTE || base === STORY_THREADS_NOTE) return false;
  return entityKindOf(note) === "note";
}

export function buildManuscript(project: { readonly scope: string }, notes: readonly ManuscriptNote[], options: ManuscriptOptions): Manuscript {
  const strip = prefixPattern(options.stripPrefix);
  const depth = Math.max(0, Math.floor(options.folderDepth));
  const ordered = notes.filter(isManuscriptNote).slice().sort(compareNotes);
  const items: ManuscriptItem[] = [];
  let previous: string[] = [];
  let count = 0, words = 0;

  for (const note of ordered) {
    const source = splitBlocks(note.text);
    if (!source.some((b) => b.kind === "paragraph" || b.kind === "quote")) continue;

    const rel = relativePath(note.path, project.scope);
    const parts = rel.split("/");
    const folders = parts.slice(0, -1).slice(0, depth);
    let i = 0;
    while (i < folders.length && i < previous.length && folders[i] === previous[i]) i++;
    for (; i < folders.length; i++) {
      items.push({ kind: "folder", level: i + 1, title: displayTitle(folders[i]!, strip), folder: `${project.scope}${parts.slice(0, i + 1).join("/")}/` });
    }
    previous = folders;

    const title = displayTitle(basenameOf(note.path), strip);
    const noteLevel = folders.length + 1;
    const firstHeading = source.find((b) => b.kind === "heading");
    const duplicate = firstHeading !== undefined && source.indexOf(firstHeading) === 0 && sameTitle(displayTitle(firstHeading.headingText, strip), title);
    const showTitle = options.noteTitles && !duplicate;
    const base = folders.length + (showTitle ? 1 : 0);
    const annotations = findAnnotations(note.text);
    const blocks: ManuscriptBlock[] = [];
    let pending: Annotation[] = [];
    for (const b of source) {
      const own = annotations.filter((a) => a.line >= b.from && a.line <= b.to);
      const kept = b.kind !== "comment" && !(options.proseOnly && !PROSE_KINDS.has(b.kind));
      if (!kept) { pending.push(...own); continue; }
      const level = b.kind === "heading" ? (options.demoteHeadings ? Math.min(6, b.heading + base) : b.heading) : 0;
      // The heading standing in for the note's name reads as the name would: sort prefix stripped.
      const headingText = duplicate && b === firstHeading ? title : b.headingText;
      const last = blocks[blocks.length - 1];
      if (last && pending.length) blocks[blocks.length - 1] = { ...last, annotations: [...last.annotations, ...pending] };
      blocks.push({ ...b, level, headingText, annotations: last ? own : [...pending, ...own] });
      pending = [];
    }
    if (pending.length && blocks.length) { const last = blocks[blocks.length - 1]!; blocks[blocks.length - 1] = { ...last, annotations: [...last.annotations, ...pending] }; }
    const w = countWords(stripComments(stripFrontMatter(note.text)));
    items.push({ kind: "note", level: noteLevel, title, path: note.path, showTitle, blocks, words: w, annotations });
    count++;
    words += w;
  }
  return { items, notes: count, words };
}

function relativePath(path: string, scope: string): string {
  if (scope === "" ) return path;
  if (scope.endsWith("/")) return path.startsWith(scope) ? path.slice(scope.length) : basenameOf(path) + ".md";
  return basenameOf(path) + ".md";
}

function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function stripFrontMatter(text: string): string {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  return end < 0 ? text : text.slice(end + 4);
}
