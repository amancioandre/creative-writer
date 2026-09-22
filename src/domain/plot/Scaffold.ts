import { htmlComment } from "../text/Comments";
import { beatComment } from "./Outline";
import { splitScenes } from "../text/Scenes";
import type { Outline } from "./Outline";

/**
 * Build the manuscript: the outline turned into folders, chapter notes
 * and scene headings, deterministically, with no model anywhere near it.
 * Planning is pure: given the outline and what already exists on disk,
 * the plan says exactly which notes are written with what, and which
 * stops in `Story threads.md` are pointed at the new headings. Nothing
 * that already exists is touched except to append a heading it lacks.
 */
export type ScaffoldShape = "chapters" | "one-note";

export interface ScaffoldFile {
  readonly path: string;
  /** The note as it will be after the build. */
  readonly content: string;
  /** The note as it was, when it already existed: headings are appended, nothing else changes. Null for a new note. */
  readonly before: string | null;
  /** Scene headings this write adds. */
  readonly headings: readonly string[];
}

export interface ScaffoldRelink {
  readonly from: string;
  readonly to: string;
}

export interface ScaffoldPlan {
  readonly shape: ScaffoldShape;
  /** Act folders the notes go in, project-relative, deepest last; created by writing the notes, removed on undo when left empty. */
  readonly folders: readonly string[];
  readonly files: readonly ScaffoldFile[];
  /** `Outline#Scene` → `Note#Scene`, one per planned scene, so every stop follows its scene into the chapter note. */
  readonly relinks: readonly ScaffoldRelink[];
  /** Scenes whose heading was already in the note: nothing written for them. */
  readonly skipped: readonly string[];
  /** Planned scenes that will be written as headings. */
  readonly scenes: number;
  /** Notes written for the first time. */
  readonly created: number;
}

export interface ScaffoldOptions {
  /** The project folder, ending in "/" (or "" for the vault root). */
  readonly folder: string;
  readonly shape: ScaffoldShape;
  /** The outline note's basename, so relinks can name it: "Outline". */
  readonly outlineName: string;
  /** The text of a note that already exists at a path, or null. */
  readonly existing: (path: string) => string | null;
}

/** A heading as a file name: what a file system and a wikilink can both carry. */
export function safeName(title: string, fallback: string): string {
  const clean = title.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  return clean || fallback;
}

/** The paths the plan would touch, so the caller can read what is already there before planning. */
export function scaffoldPaths(outline: Outline, folder: string, shape: ScaffoldShape): string[] {
  if (shape === "one-note") return [`${folder}Draft.md`];
  const out: string[] = [];
  let order = 0;
  for (const act of outline.acts) for (const chapter of act.chapters) out.push(chapterPath(folder, act.title, chapter.title, ++order));
  return out;
}

function chapterPath(folder: string, act: string, chapter: string, order: number): string {
  const dir = act.trim() ? `${folder}${safeName(act, "Act")}/` : folder;
  return `${dir}${safeName(chapter, `Chapter ${order}`)}.md`;
}

export function planScaffold(outline: Outline, options: ScaffoldOptions): ScaffoldPlan {
  const { folder, shape, outlineName } = options;
  const files: ScaffoldFile[] = [];
  const relinks: ScaffoldRelink[] = [];
  const skipped: string[] = [];
  const folders: string[] = [];
  let scenes = 0, created = 0;
  const link = (path: string, title: string) => `${path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "")}#${title}`;

  const write = (path: string, order: number, planned: readonly { title: string; logline: string; beats: readonly string[] }[]) => {
    const before = options.existing(path);
    const have = new Set((before ? splitScenes(before) : []).map((s) => s.title.trim().toLowerCase()));
    const fresh = planned.filter((s) => { const known = have.has(s.title.trim().toLowerCase()); if (known) skipped.push(s.title); return !known; });
    for (const s of planned) relinks.push({ from: `${outlineName}#${s.title}`, to: link(path, s.title) });
    if (before !== null && fresh.length === 0) return;
    const body = fresh.map((s) => `## ${s.title}\n${s.logline ? `${htmlComment(s.logline)}\n` : ""}${s.beats.map((b) => `${beatComment(b)}\n`).join("")}`).join("\n");
    const content = before === null ? `---\nstory-order: ${order}\n---\n${body}` : `${before.replace(/\s*$/, "")}\n\n${body}`;
    files.push({ path, content, before, headings: fresh.map((s) => s.title) });
    scenes += fresh.length;
    if (before === null) created++;
  };

  if (shape === "one-note") {
    write(`${folder}Draft.md`, 1, outline.acts.flatMap((a) => a.chapters.flatMap((c) => c.scenes)));
  } else {
    let order = 0;
    for (const act of outline.acts) {
      if (act.title.trim()) { const dir = `${folder}${safeName(act.title, "Act")}`; if (!folders.includes(dir)) folders.push(dir); }
      for (const chapter of act.chapters) write(chapterPath(folder, act.title, chapter.title, ++order), order, chapter.scenes);
    }
  }
  return { shape, folders, files, relinks, skipped, scenes, created };
}

/** The plan as the sheet shows it: one line per folder, note and heading, in writing order. */
export function describeScaffold(plan: ScaffoldPlan, folder: string): string[] {
  const lines: string[] = [];
  let lastDir = "";
  for (const f of plan.files) {
    const rel = f.path.startsWith(folder) ? f.path.slice(folder.length) : f.path;
    const slash = rel.lastIndexOf("/");
    const dir = slash < 0 ? "" : rel.slice(0, slash);
    if (dir !== lastDir) { lastDir = dir; if (dir) lines.push(`${dir}/`); }
    const order = /story-order:\s*(\d+)/.exec(f.content)?.[1];
    lines.push(`${dir ? "  " : ""}${rel.slice(slash + 1)}${f.before === null ? (order ? `  story-order ${order}` : "") : "  exists, headings appended"}`);
    for (const h of f.headings) lines.push(`${dir ? "    " : "  "}## ${h}`);
  }
  return lines;
}
