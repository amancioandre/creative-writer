import type { ProjectNotes } from "../../application/ports/ProjectNotes";
import { inScope, parseProjectFrontmatter, type ProjectSpec } from "../../domain/progress/Project";
import type { ProjectNote } from "../../domain/story/BuildGraph";
import { parseRelations } from "../../domain/story/Relations";
import { isNoteCounted } from "../../domain/scope/NoteScope";
import { splitScenes } from "../../domain/text/Scenes";

/** The slice of Obsidian's `App` this adapter touches, typed structurally so tests can fake it. */
export interface FileLike { readonly path: string }
export interface CacheLike {
  readonly frontmatter?: Record<string, unknown>;
  readonly links?: ReadonlyArray<{ link: string }>;
  readonly embeds?: ReadonlyArray<{ link: string }>;
  readonly frontmatterLinks?: ReadonlyArray<{ link: string }>;
}
export interface VaultAppLike {
  readonly vault: { getMarkdownFiles(): FileLike[]; cachedRead(f: FileLike): Promise<string> };
  readonly metadataCache: { getFileCache(f: FileLike): CacheLike | null; getFirstLinkpathDest(link: string, source: string): FileLike | null };
  /** Obsidian's core Bookmarks plugin, reached through the (undocumented but stable) internal-plugins registry. */
  readonly internalPlugins?: { getPluginById(id: string): { enabled?: boolean; instance?: { items?: unknown[] } } | null };
}

interface BookmarkItem { type?: string; path?: string; subpath?: string; items?: BookmarkItem[] }

/** Without a scope from the host: every note but the opted-out ones and the plugin's own data notes. */
const anyNote = (path: string, frontmatter: Record<string, unknown> | undefined): boolean =>
  isNoteCounted({ enabled: true, scope: { mode: "all", folders: [] }, path, flag: frontmatter?.["creative-writer"] === false ? false : null, frontmatter });

/**
 * Reads a project's notes through the metadata cache — links already resolved, front matter already parsed.
 * `counted` is the vault-wide scope rule (see WritingScope): memos, research and reviews that the writer
 * opted out, notes outside the configured scope, and the plugin's own data notes are not read.
 */
export class VaultProjectNotes implements ProjectNotes {
  constructor(
    private readonly app: VaultAppLike,
    private readonly counted: (path: string, frontmatter: Record<string, unknown> | undefined) => boolean = anyNote,
  ) {}

  projects(): ProjectSpec[] {
    return this.app.vault
      .getMarkdownFiles()
      .map((f) => parseProjectFrontmatter(this.app.metadataCache.getFileCache(f)?.frontmatter, f.path))
      .filter((s): s is ProjectSpec => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async notes(project: ProjectSpec): Promise<ProjectNote[]> {
    const bookmarks = this.bookmarks();
    const out: ProjectNote[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!inScope(project, f.path)) continue;
      const cache = this.app.metadataCache.getFileCache(f);
      const fm = cache?.frontmatter;
      if (!this.counted(f.path, fm)) continue;
      const links = new Set<string>();
      for (const l of [...(cache?.links ?? []), ...(cache?.embeds ?? []), ...(cache?.frontmatterLinks ?? [])]) {
        const target = this.app.metadataCache.getFirstLinkpathDest(l.link.split("#")[0]!.split("|")[0]!, f.path);
        if (target && target.path !== f.path) links.add(target.path);
      }
      const text = await this.app.vault.cachedRead(f);
      out.push({
        path: f.path,
        frontmatter: fm ?? {},
        links: [...links],
        bookmarked: bookmarks.files.has(f.path),
        bookmarkedHeadings: bookmarks.headings.get(f.path) ?? [],
        scenes: splitScenes(text),
        relations: parseRelations(text).map((r) => ({ ...r, targetPath: this.app.metadataCache.getFirstLinkpathDest(r.target, f.path)?.path ?? null })),
      });
    }
    return out;
  }

  private bookmarks(): { files: Set<string>; headings: Map<string, string[]> } {
    const files = new Set<string>();
    const headings = new Map<string, string[]>();
    const plugin = this.app.internalPlugins?.getPluginById("bookmarks");
    const walk = (items: unknown[] | undefined) => {
      for (const raw of items ?? []) {
        const item = (raw && typeof raw === "object" ? raw : {}) as BookmarkItem;
        if (item.type === "group") walk(item.items);
        if (!item.path) continue;
        if (item.type === "file") files.add(item.path);
        if (item.type === "heading" && item.subpath) {
          const list = headings.get(item.path) ?? [];
          list.push(item.subpath.replace(/^#/, ""));
          headings.set(item.path, list);
        }
      }
    };
    if (plugin?.enabled !== false) walk(plugin?.instance?.items);
    return { files, headings };
  }
}
