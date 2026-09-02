import { STORY_MAP_FLAG } from "../story/StoryMapFile";
import { STORY_THREADS_FLAG } from "../threads/StoryThreadsNote";
import { WRITING_LOG_FLAG } from "../progress/WritingLogNote";
import { MANUSCRIPT_EXPORT_FLAG } from "../manuscript/Export";

/**
 * Where the plugin runs — and what it counts. One rule for every feature:
 * the editor tools, the daily goal, project totals, the story map and the
 * threads all read the same set of notes. A note's front matter always wins
 * (`creative-writer: true|false`); below that, the scope setting decides.
 */
export type ScopeMode = "all" | "marked" | "folders" | "projects";

export interface ScopeSettings {
  readonly mode: ScopeMode;
  /** Vault-relative folder prefixes, used when mode is "folders". */
  readonly folders: readonly string[];
}

export const FRONTMATTER_KEY = "creative-writer";

/** Front-matter keys that mark a note as one the plugin wrote itself; never prose, never counted, never read. */
export const PLUGIN_DATA_FLAGS: readonly string[] = [WRITING_LOG_FLAG, STORY_MAP_FLAG, STORY_THREADS_FLAG, MANUSCRIPT_EXPORT_FLAG];

export function isPluginDataNote(frontmatter: unknown): boolean {
  if (!frontmatter || typeof frontmatter !== "object") return false;
  const fm = frontmatter as Record<string, unknown>;
  return PLUGIN_DATA_FLAGS.some((k) => fm[k] !== undefined);
}

/** A project scope is a folder prefix ending in "/" ("" for the vault root) or a single note's path. */
export function pathInScope(path: string, scope: string): boolean {
  return scope.endsWith("/") || scope === "" ? path.startsWith(scope) : path === scope;
}

/** Reads the `creative-writer` flag from a note's front matter block, if any. */
export function frontmatterFlag(text: string, key = FRONTMATTER_KEY): boolean | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  const block = text.slice(3, end);
  const m = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+?)\\s*$`, "mi").exec(block);
  if (!m) return null;
  const v = m[1]!.toLowerCase().replace(/^["']|["']$/g, "");
  if (v === "true" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "no" || v === "off") return false;
  return null;
}

export interface ActivationInput {
  /** Global master switch. */
  readonly enabled: boolean;
  readonly scope: ScopeSettings;
  /** Vault-relative path of the note, or null when unknown (no file). */
  readonly path: string | null;
  /** Front-matter flag, or null when absent. */
  readonly flag: boolean | null;
  /** Scopes of the declared projects (see Project.ts); used when mode is "projects". */
  readonly projectScopes?: readonly string[];
}

/**
 * A declared project is the story: its notes are in whatever the mode, the
 * way `creative-writer: true` would put them in. The mode decides only what
 * happens outside the projects.
 */
export function isNoteActive({ enabled, scope, path, flag, projectScopes = [] }: ActivationInput): boolean {
  if (!enabled) return false;
  if (flag !== null) return flag;
  if (path !== null && projectScopes.some((s) => pathInScope(path, s))) return true;
  switch (scope.mode) {
    case "all":
      return true;
    case "marked":
    case "projects":
      return false;
    case "folders":
      return path !== null && scope.folders.some((f) => inFolder(path, f));
  }
}

export interface CountingInput extends ActivationInput {
  /** The note's parsed front matter, if known; used to keep the plugin's own data notes out. */
  readonly frontmatter?: unknown;
}

/**
 * Whether a note's words are the writer's work: active by the scope rule,
 * and not a note the plugin wrote for itself (writing log, story map, threads).
 */
export function isNoteCounted(input: CountingInput): boolean {
  if (isPluginDataNote(input.frontmatter)) return false;
  return isNoteActive(input);
}

function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  if (f === "") return true;
  return path === f || path.startsWith(`${f}/`);
}
