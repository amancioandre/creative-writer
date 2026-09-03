import type { WriterNotes } from "../../application/ports/WriterNotes";
import type { WriterNote } from "../../domain/writer/Board";
import { hasWriterTag } from "../../domain/writer/Tags";
import { linkTarget, parseReading } from "../../domain/writer/Stories";

/** The slice of Obsidian's `App` this adapter touches, typed structurally so tests can fake it. */
export interface FileLike { readonly path: string }
export interface CacheLike {
  readonly frontmatter?: Record<string, unknown>;
  /** Inline tags, with their `#`. */
  readonly tags?: ReadonlyArray<{ tag: string }>;
  readonly links?: ReadonlyArray<{ link: string }>;
  readonly embeds?: ReadonlyArray<{ link: string }>;
  readonly frontmatterLinks?: ReadonlyArray<{ link: string }>;
}
export interface WriterAppLike {
  readonly vault: { getMarkdownFiles(): FileLike[]; cachedRead(f: FileLike): Promise<string> };
  readonly metadataCache: { getFileCache(f: FileLike): CacheLike | null; getFirstLinkpathDest(link: string, source: string): FileLike | null };
}

/** Every tag of a note as Obsidian would list it: inline ones and the front matter's `tags` / `tag`, with or without `#`. */
export function tagsOf(cache: CacheLike | null): string[] {
  const out: string[] = [];
  for (const t of cache?.tags ?? []) if (typeof t.tag === "string") out.push(t.tag);
  for (const key of ["tags", "tag"]) {
    const raw = cache?.frontmatter?.[key];
    const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
    for (const t of list) if (typeof t === "string" && t.trim()) out.push(t.trim());
  }
  return out;
}

const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** The first paragraph of prose: front matter, headings, blank lines and comments skipped; cut at 280 characters. */
export function excerptOf(text: string): string {
  const body = text.replace(FRONT_MATTER, "").replace(/%%[\s\S]*?%%/g, "");
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l && !/^#{1,6}\s/.test(l) && !/^---+$/.test(l));
    if (!lines.length) continue;
    const para = lines.join(" ").replace(/\s+/g, " ");
    return para.length > 280 ? para.slice(0, 279).trimEnd() + "…" : para;
  }
  return "";
}

/** Reads the vault's tagged notes through the metadata cache; the text is read only for those, for the excerpt. */
export class VaultWriterNotes implements WriterNotes {
  constructor(
    private readonly app: WriterAppLike,
    /** The text of a note open in an editor, unsaved edits included; null when it is not open. */
    private readonly liveText: (path: string) => string | null = () => null,
  ) {}

  async notes(prefix: string): Promise<WriterNote[]> {
    const out: WriterNote[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(f);
      const tags = tagsOf(cache);
      if (!hasWriterTag(tags, prefix)) continue;
      const links = new Set<string>();
      for (const l of [...(cache?.links ?? []), ...(cache?.embeds ?? []), ...(cache?.frontmatterLinks ?? [])]) {
        const target = this.app.metadataCache.getFirstLinkpathDest(l.link.split("#")[0]!.split("|")[0]!, f.path);
        if (target && target.path !== f.path) links.add(target.path);
      }
      const text = this.liveText(f.path) ?? await this.app.vault.cachedRead(f);
      const title = f.path.slice(f.path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
      const storyLink = linkTarget(cache?.frontmatter?.["writer-story"]);
      const story = storyLink ? this.app.metadataCache.getFirstLinkpathDest(storyLink, f.path)?.path ?? null : null;
      out.push({ path: f.path, title, tags, links: [...links], excerpt: excerptOf(text), story, reading: parseReading(cache?.frontmatter?.["reading"]) });
    }
    return out;
  }
}
