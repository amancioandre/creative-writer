import type { NoteVaultLike } from "./StoryMapNoteRepository";

/** The slice of Obsidian's vault the note repositories need, typed structurally so tests can fake it. */
export interface VaultLike {
  getAbstractFileByPath(path: string): { path: string; children?: unknown } | null;
  cachedRead(file: unknown): Promise<string>;
  modify(file: unknown, content: string): Promise<void>;
  create(path: string, content: string): Promise<unknown>;
  createFolder(path: string): Promise<unknown>;
  /** Only the build's undo deletes: a note it created and that is still exactly what it wrote. */
  delete(file: unknown): Promise<void>;
  /** The disk under the index: `vault.delete` cannot take a folder in every Obsidian build, the adapter's `rmdir` can, and `list` says whether it is truly empty first. */
  adapter: { list(path: string): Promise<{ files: string[]; folders: string[] }>; rmdir(path: string, recursive: boolean): Promise<void> };
}

/** The note IO with the two removals the build's undo needs. */
export interface NoteVaultIO extends NoteVaultLike {
  remove(path: string): Promise<void>;
  removeFolderIfEmpty(path: string): Promise<boolean>;
}

/**
 * Read/write a note by path, creating it — and any missing parent folders —
 * on first write. A file is anything `getAbstractFileByPath` returns
 * without `children`; a folder has them.
 */
export function vaultNoteIO(vault: VaultLike): NoteVaultIO {
  const isFile = (p: string) => { const f = vault.getAbstractFileByPath(p); return !!f && f.children === undefined; };
  return {
    remove: async (p) => { const f = vault.getAbstractFileByPath(p); if (f && f.children === undefined) await vault.delete(f); },
    removeFolderIfEmpty: async (p) => {
      const f = vault.getAbstractFileByPath(p);
      if (!f || f.children === undefined) return false;
      // The index can lag a deletion; the disk is asked, so a folder with anything still in it is never touched.
      const on = await vault.adapter.list(p);
      if (on.files.length || on.folders.length) return false;
      await vault.adapter.rmdir(p, true);
      return true;
    },
    exists: async (p) => isFile(p),
    read: async (p) => vault.cachedRead(vault.getAbstractFileByPath(p)),
    write: async (p, content) => {
      const existing = vault.getAbstractFileByPath(p);
      if (existing && existing.children === undefined) { await vault.modify(existing, content); return; }
      const parts = p.split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        if (vault.getAbstractFileByPath(dir)) continue;
        // The index can lag the disk (early in a reload, or after an external sync): a folder that is there but not
        // yet known is fine to keep, so only a genuinely failed create is an error.
        try { await vault.createFolder(dir); } catch (e) { if (!/already exists/i.test(e instanceof Error ? e.message : String(e))) throw e; }
      }
      await vault.create(p, content);
    },
  };
}
