import type { WriterVault } from "../../application/ports/WriterVault";
import { splitScenes } from "../../domain/text/Scenes";
import type { NoteVaultLike } from "./StoryMapNoteRepository";

/** The slice of Obsidian this adapter touches, typed structurally for tests. */
export interface FilesAppLike {
  readonly vault: {
    getMarkdownFiles(): { path: string }[];
    getAbstractFileByPath(path: string): { path: string; children?: unknown } | null;
    createFolder(path: string): Promise<unknown>;
  };
  readonly metadataCache: {
    getFileCache(f: { path: string }): { frontmatter?: Record<string, unknown> } | null;
    getFirstLinkpathDest(link: string, source: string): { path: string } | null;
  };
}

/** Files and front matter for the stories row and promotion. Note reads and writes go through the shared note IO. */
export class VaultWriterFiles implements WriterVault {
  constructor(
    private readonly app: FilesAppLike,
    private readonly notes: NoteVaultLike,
    private readonly frontMatter: (path: string, change: (fm: Record<string, unknown>) => void) => Promise<void>,
  ) {}

  paths(): string[] { return this.app.vault.getMarkdownFiles().map((f) => f.path); }
  frontmatter(path: string): Record<string, unknown> | null { return this.app.metadataCache.getFileCache({ path })?.frontmatter ?? null; }
  resolve(link: string, from: string): string | null { return this.app.metadataCache.getFirstLinkpathDest(link, from)?.path ?? null; }
  async exists(path: string): Promise<boolean> { return this.app.vault.getAbstractFileByPath(path) !== null; }
  read(path: string): Promise<string> { return this.notes.read(path); }
  write(path: string, text: string): Promise<void> { return this.notes.write(path, text); }
  async createFolder(path: string): Promise<void> {
    const parts = path.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      if (this.app.vault.getAbstractFileByPath(dir)) continue;
      try { await this.app.vault.createFolder(dir); } catch (e) { if (!/already exists/i.test(e instanceof Error ? e.message : String(e))) throw e; }
    }
  }
  processFrontMatter(path: string, change: (fm: Record<string, unknown>) => void): Promise<void> { return this.frontMatter(path, change); }
  async folderHasProse(folder: string): Promise<boolean> {
    for (const p of this.paths()) {
      if (!p.startsWith(`${folder}/`)) continue;
      if (splitScenes(await this.notes.read(p)).some((s) => s.prose.trim().length > 0)) return true;
    }
    return false;
  }
}
