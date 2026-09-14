import { parseWordLists, type WordCategory } from "../../domain/words/WordList";
import type { WordLists } from "../codemirror/wordsExtension";

/** The slice of the vault the loader needs, typed structurally so tests can fake it. */
export interface WordListVault {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  /** A wiki link or path as written in a project note's `bad-words`, resolved from that note; null when it points nowhere. */
  resolveLink(link: string, fromNotePath: string): string | null;
}

export interface WordListProject {
  readonly scope: string;
  readonly notePath: string;
  readonly wordsNote?: string;
}

export interface LoadedWordLists {
  readonly lists: WordLists;
  /** Every note that was read, so the host can reload when one of them changes. */
  readonly paths: readonly string[];
}

/**
 * Reads the vault-wide word list note and each project's own (`bad-words:` in
 * the project note). A missing note is simply an empty list; a project
 * whose link resolves nowhere falls back to the global list.
 */
export async function loadWordLists(vault: WordListVault, vaultNote: string, projects: readonly WordListProject[]): Promise<LoadedWordLists> {
  const paths: string[] = [];
  const readLists = async (path: string): Promise<WordCategory[] | null> => {
    if (!(await vault.exists(path))) return null;
    paths.push(path);
    return parseWordLists(await vault.read(path));
  };
  const shared = (await readLists(vaultNote)) ?? [];
  const vaultPath = paths.includes(vaultNote) ? vaultNote : null;
  const byScope: Record<string, readonly WordCategory[]> = {};
  const scopePaths: Record<string, string> = {};
  for (const p of projects) {
    if (!p.wordsNote) continue;
    const path = vault.resolveLink(p.wordsNote, p.notePath);
    if (!path) continue;
    const lists = await readLists(path);
    if (lists) { byScope[p.scope] = lists; scopePaths[p.scope] = path; }
  }
  return { lists: { vault: shared, byScope, vaultPath, scopePaths }, paths };
}
