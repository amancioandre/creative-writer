/**
 * Where the plugin runs. A note's front matter always wins
 * (`creative-writer: true|false`); below that, the scope setting decides.
 */
export type ScopeMode = "all" | "marked" | "folders";

export interface ScopeSettings {
  readonly mode: ScopeMode;
  /** Vault-relative folder prefixes, used when mode is "folders". */
  readonly folders: readonly string[];
}

export const FRONTMATTER_KEY = "creative-writer";

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
}

export function isNoteActive({ enabled, scope, path, flag }: ActivationInput): boolean {
  if (!enabled) return false;
  if (flag !== null) return flag;
  switch (scope.mode) {
    case "all":
      return true;
    case "marked":
      return false;
    case "folders":
      return path !== null && scope.folders.some((f) => inFolder(path, f));
  }
}

function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  if (f === "") return true;
  return path === f || path.startsWith(`${f}/`);
}
