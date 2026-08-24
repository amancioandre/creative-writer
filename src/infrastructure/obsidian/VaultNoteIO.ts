import type { NoteVaultLike } from "./StoryMapNoteRepository";

/** The slice of Obsidian's vault the note repositories need, typed structurally so tests can fake it. */
export interface VaultLike {
  getAbstractFileByPath(path: string): { path: string; children?: unknown } | null;
  cachedRead(file: unknown): Promise<string>;
  modify(file: unknown, content: string): Promise<void>;
  create(path: string, content: string): Promise<unknown>;
  createFolder(path: string): Promise<unknown>;
}

/**
 * Read/write a note by path, creating it — and any missing parent folders —
 * on first write. A file is anything `getAbstractFileByPath` returns
 * without `children`; a folder has them.
 */
export function vaultNoteIO(vault: VaultLike): NoteVaultLike {
  const isFile = (p: string) => { const f = vault.getAbstractFileByPath(p); return !!f && f.children === undefined; };
  return {
    exists: async (p) => isFile(p),
    read: async (p) => vault.cachedRead(vault.getAbstractFileByPath(p)),
    write: async (p, content) => {
      const existing = vault.getAbstractFileByPath(p);
      if (existing && existing.children === undefined) { await vault.modify(existing, content); return; }
      const parts = p.split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
      }
      await vault.create(p, content);
    },
  };
}
