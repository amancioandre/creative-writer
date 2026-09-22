import { basenameOf, normalise } from "../story/EntityIndex";
import { parseColumnHeading, type ColumnKind } from "../threads/StoryThreadsNote";
import { stripComments, type CommentState } from "../text/Comments";
import { parseOutline, type Outline } from "./Outline";
import { safeName } from "./Scaffold";

/**
 * A template is a markdown note, not code: a starting shape for the grid
 * written in the grammar the grid already reads.
 *
 *     ---
 *     creative-writer-template: 1
 *     plot-time: Time
 *     plot-pov: POV
 *     plot-theme: Theme: Major theme
 *     plot-beats: Plot point
 *     ---
 *     # Columns
 *     ## Time
 *     ## POV
 *     ## Arc: Character A
 *
 *     # Act I
 *     ## Chapter
 *     ### Opening image
 *     <!-- A snapshot of the hero before anything changes -->
 *     <!-- beat: Opening image -->
 *
 * The `##` headings under `# Columns` are columns, as `Story threads.md`
 * writes them; the front matter names the jobs. Everything else is the
 * outline's grammar: `#` act, `##` chapter, `###` scene, a comment as the
 * scene's purpose and a `beat:` comment as its tag. A note with no `#`
 * heading at all is columns only, the shape of a threads note. Applying
 * writes headings and nothing else; the model is never involved.
 */
export const TEMPLATE_FLAG = "creative-writer-template";
export const TEMPLATE_VERSION = 1;
const COLUMNS_SECTION = "columns";
/** The arc heading a template writes to mean "one arc for every character in the cast". */
export const EVERY_CHARACTER = "every character";

export interface TemplateColumn {
  /** The heading as written in the template. */
  readonly heading: string;
  readonly kind: ColumnKind;
  readonly name: string;
  /** An arc that names nobody in particular ("Character A"), to be bound to a cast member before it is written; or one arc per character. */
  readonly placeholder: "arc" | "every-character" | null;
}

export interface StoryTemplate {
  readonly name: string;
  /** The note's path, or null for one shipped in the plugin. */
  readonly path: string | null;
  readonly columns: readonly TemplateColumn[];
  /** Which template headings the project note should name as its Time, POV, main theme and plot point. */
  readonly jobs: { readonly time?: string; readonly pov?: string; readonly theme?: string; readonly beats?: string };
  /** The structure part, in the outline's grammar, as it will be appended to Outline.md; "" when the template has no rows. */
  readonly structure: string;
  readonly outline: Outline;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

function frontMatter(lines: readonly string[]): { end: number; values: Record<string, string> } {
  if (lines[0] !== "---") return { end: 0, values: {} };
  const close = lines.indexOf("---", 1);
  if (close < 0) return { end: 0, values: {} };
  const values: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const m = /^([^:]+):\s*(.*?)\s*$/.exec(line);
    if (m) values[m[1]!.trim()] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return { end: close + 1, values };
}

export function parseTemplate(markdown: string, name: string, path: string | null = null): StoryTemplate {
  const lines = markdown.split("\n");
  const { end, values } = frontMatter(lines);
  const body = lines.slice(end);
  // Split the body: the `# Columns` section on one side, everything else (the structure) on the other.
  const columnLines: string[] = [];
  const structureLines: string[] = [];
  let inColumns = false, inFence = false, hasActs = false;
  let comment: CommentState = null;
  for (const raw of body) {
    if (FENCE.test(raw)) inFence = !inFence;
    const stripped: { text: string; state: CommentState } = inFence ? { text: "", state: comment } : stripComments(raw, comment);
    comment = stripped.state;
    const m = inFence ? null : HEADING.exec(stripped.text);
    if (m && m[1]!.length === 1) { inColumns = m[2]!.trim().toLowerCase() === COLUMNS_SECTION; if (!inColumns) hasActs = true; if (inColumns) continue; }
    (inColumns ? columnLines : structureLines).push(raw);
  }
  // A note with no `#` heading is a threads note: its `##` headings are the columns and there are no rows.
  const columnSource = hasActs || columnLines.length ? columnLines : structureLines;
  const columns = columnSource
    .map((l) => HEADING.exec(l))
    .filter((m): m is RegExpExecArray => !!m && m[1]!.length === 2)
    .map((m) => column(m[2]!.trim()));
  const structure = hasActs || columnLines.length ? structureLines.join("\n").replace(/^\s+|\s+$/g, "") : "";
  const outline = parseOutline(structure);
  const jobs = { ...(values["plot-time"] ? { time: values["plot-time"] } : {}), ...(values["plot-pov"] ? { pov: values["plot-pov"] } : {}), ...(values["plot-theme"] ? { theme: values["plot-theme"] } : {}), ...(values["plot-beats"] ? { beats: values["plot-beats"] } : {}) };
  return { name, path, columns, jobs, structure: outline.scenes ? structure : "", outline };
}

function column(heading: string): TemplateColumn {
  const parsed = parseColumnHeading(heading);
  const placeholder = parsed.kind === "arc" ? (normalise(parsed.name) === normalise(EVERY_CHARACTER) ? "every-character" : "arc") : null;
  return { heading, kind: parsed.kind, name: parsed.name, placeholder };
}

/** What the writer chose in the sheet: which parts, which headings, the names given to placeholders, the cast members bound to arcs. */
export interface ApplyChoices {
  readonly rows: boolean;
  readonly columns: boolean;
  /** Template headings left in; absent means all. */
  readonly ticked?: ReadonlySet<string>;
  /** Template heading → the name to write instead (a theme or subplot renamed before it exists). */
  readonly names?: Readonly<Record<string, string>>;
  /** Template heading → the cast member an arc placeholder is bound to. */
  readonly bindings?: Readonly<Record<string, string>>;
}

export interface ApplyContext {
  /** Headings already in Story threads.md. */
  readonly existing: readonly string[];
  readonly cast: readonly { readonly name: string; readonly kind: string; readonly path: string | null }[];
}

export interface ApplyPlan {
  /** Headings to write to Story threads.md, in template order. */
  readonly headings: readonly string[];
  /** Headings the note already has, by heading or by name inside the kind: not written again. */
  readonly skipped: readonly string[];
  /** The project note keys to set, each to the heading as it will be written. */
  readonly jobs: { readonly time?: string; readonly pov?: string; readonly theme?: string; readonly beats?: string };
  /** The structure to append to Outline.md, or null when rows were not chosen or the template has none. */
  readonly structure: string | null;
  readonly scenes: number;
}

const prefixed = (kind: ColumnKind, name: string) => kind === "free" ? name : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}: ${name}`;

/** An arc bound to a cast member links their note, so Obsidian keeps the heading current when the note is renamed. */
function arcHeading(cast: ApplyContext["cast"], name: string): string {
  const hit = cast.find((c) => normalise(c.name) === normalise(name) || (c.path && normalise(basenameOf(c.path)) === normalise(name)));
  return `Arc: [[${hit?.path ? basenameOf(hit.path) : name}]]`;
}

/** Resolves the template against the project: placeholders bound or expanded, names applied, what exists left alone. Pure. */
export function planApply(template: StoryTemplate, choices: ApplyChoices, context: ApplyContext): ApplyPlan {
  const existing = context.existing.map((h) => parseColumnHeading(h));
  const isThere = (heading: string) => {
    const p = parseColumnHeading(heading);
    return existing.some((e) => e.heading.toLowerCase() === p.heading.toLowerCase() || (e.kind === p.kind && normalise(e.name) === normalise(p.name)));
  };
  const headings: string[] = [];
  const skipped: string[] = [];
  const written = new Map<string, string>();
  if (choices.columns) {
    for (const c of template.columns) {
      if (choices.ticked && !choices.ticked.has(c.heading)) continue;
      const resolved: string[] = [];
      if (c.placeholder === "every-character") resolved.push(...context.cast.filter((m) => m.kind === "character").map((m) => arcHeading(context.cast, m.name)));
      else if (c.placeholder === "arc") { const bound = choices.bindings?.[c.heading]?.trim(); resolved.push(bound ? arcHeading(context.cast, bound) : c.heading); }
      else { const name = choices.names?.[c.heading]?.trim(); resolved.push(name ? prefixed(c.kind, name) : c.heading); }
      for (const h of resolved) {
        if (isThere(h) || headings.some((x) => x.toLowerCase() === h.toLowerCase())) { skipped.push(h); continue; }
        headings.push(h);
      }
      if (resolved[0]) written.set(c.heading, resolved[0]);
    }
  }
  const job = (heading: string | undefined) => { if (!heading) return undefined; const w = written.get(heading) ?? (isThere(heading) ? heading : undefined); return w; };
  const jobs = { ...(job(template.jobs.time) ? { time: job(template.jobs.time)! } : {}), ...(job(template.jobs.pov) ? { pov: job(template.jobs.pov)! } : {}), ...(job(template.jobs.theme) ? { theme: job(template.jobs.theme)! } : {}), ...(job(template.jobs.beats) ? { beats: job(template.jobs.beats)! } : {}) };
  const structure = choices.rows && template.structure ? template.structure : null;
  return { headings, skipped, jobs, structure, scenes: structure ? template.outline.scenes : 0 };
}

/** The note a grid is saved as: the columns it has, the jobs the project note gives them, and the outline as it stands. */
export function serializeTemplate(name: string, parts: { readonly columns: readonly string[]; readonly jobs: { time?: string; pov?: string; theme?: string; beats?: string }; readonly structure: string }): string {
  const fm = ["---", `${TEMPLATE_FLAG}: ${TEMPLATE_VERSION}`];
  if (parts.jobs.time) fm.push(`plot-time: ${parts.jobs.time}`);
  if (parts.jobs.pov) fm.push(`plot-pov: ${parts.jobs.pov}`);
  if (parts.jobs.theme) fm.push(`plot-theme: ${parts.jobs.theme}`);
  if (parts.jobs.beats) fm.push(`plot-beats: ${parts.jobs.beats}`);
  fm.push("---");
  const out = [...fm, `A grid template, **${name}**. Under \`# Columns\`, one \`##\` heading per column; below, acts, chapters and scenes in the outline's grammar, a comment as a scene's purpose and a \`beat:\` comment as its tag. Start from a template… in the plot grid applies it.`, ""];
  if (parts.columns.length) { out.push("# Columns", ...parts.columns.map((c) => `## ${c}`), ""); }
  if (parts.structure.trim()) out.push(parts.structure.trim(), "");
  return out.join("\n");
}

/** A file name for a saved template that does not collide with one already there. */
export function templateFileName(name: string, taken: readonly string[]): string {
  const base = safeName(name, "Template");
  const has = (n: string) => taken.some((t) => t.toLowerCase() === n.toLowerCase());
  if (!has(base)) return base;
  for (let i = 2; i < 100; i++) if (!has(`${base} ${i}`)) return `${base} ${i}`;
  return `${base} ${Date.now()}`;
}
