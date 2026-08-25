import type { WritingScope } from "../../application/ports/WritingScope";
import { frontmatterFlag, isNoteCounted } from "../../domain/scope/NoteScope";
import type { PluginSettings } from "../../domain/settings/Settings";

/** The slice of Obsidian's `App` this adapter touches, typed structurally so tests can fake it. */
export interface ScopeAppLike {
  readonly metadataCache: { getCache(path: string): { frontmatter?: Record<string, unknown> } | null };
}

/**
 * Answers through the metadata cache — front matter already parsed — with
 * the live settings and the currently declared projects. A path with no
 * cache entry (a note since deleted, a log line from another machine) is
 * judged by its path alone.
 */
export class VaultWritingScope implements WritingScope {
  constructor(
    private readonly app: ScopeAppLike,
    private readonly settings: () => Pick<PluginSettings, "enabled" | "scope">,
    private readonly projectScopes: () => readonly string[],
  ) {}

  counts(path: string, text?: string): boolean {
    const s = this.settings();
    const frontmatter = this.app.metadataCache.getCache(path)?.frontmatter;
    const flag = text !== undefined ? frontmatterFlag(text) : flagOf(frontmatter);
    return isNoteCounted({ enabled: s.enabled, scope: s.scope, path, flag, frontmatter, projectScopes: this.projectScopes() });
  }
}

function flagOf(frontmatter: Record<string, unknown> | undefined): boolean | null {
  const v = frontmatter?.["creative-writer"];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return frontmatterFlag(`---\ncreative-writer: ${v}\n---\n`);
  return null;
}
