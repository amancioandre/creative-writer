import { writerTag } from "../../domain/writer/Tags";

/** The two ways Obsidian lets a plugin edit a note: its front matter as an object, or its text. Typed structurally for tests. */
export interface TagVaultLike {
  processFrontMatter(path: string, change: (fm: Record<string, unknown>) => void): Promise<void>;
  process(path: string, change: (text: string) => string): Promise<void>;
}

const same = (a: string, b: string) => a.replace(/^#/, "").toLowerCase() === b.toLowerCase();

/**
 * Rewrites a note's writer tags when a card is dragged between groups,
 * added to one, or removed from one. A tag found in the front matter
 * (`tags` or `tag`) is replaced there; one found inline in the text is
 * replaced in place; a tag with nothing to replace goes to the front matter.
 */
export class VaultWriterTags {
  constructor(private readonly vault: TagVaultLike) {}

  /** `from` null adds `to`; `to` null removes `from`; both replace one with the other. */
  async retag(path: string, prefix: string, from: string | null, to: string | null): Promise<void> {
    if (!from && !to) return;
    const fromTag = from ? writerTag(prefix, from) : null;
    const toTag = to ? writerTag(prefix, to) : null;
    let inFrontMatter = false;
    await this.vault.processFrontMatter(path, (fm) => {
      inFrontMatter = !!fromTag && listOf(fm).some((t) => same(t, fromTag));
      if (fromTag && !inFrontMatter) return;
      setList(fm, listOf(fm).filter((t) => !fromTag || !same(t, fromTag)), toTag);
    });
    if (!fromTag || inFrontMatter) return;
    let inline = false;
    const pattern = new RegExp(`(^|[ \\t])#${escape(fromTag)}(?![\\w/-])`, "gim");
    await this.vault.process(path, (text) => text.replace(pattern, (_m, lead: string) => { inline = true; return toTag ? `${lead}#${toTag}` : ""; }));
    if (!inline && toTag) await this.vault.processFrontMatter(path, (fm) => setList(fm, listOf(fm), toTag));
  }
}

function listOf(fm: Record<string, unknown>): string[] {
  const raw = fm[keyOf(fm)];
  return (Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : []).filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim());
}

function keyOf(fm: Record<string, unknown>): string {
  return "tags" in fm ? "tags" : "tag" in fm ? "tag" : "tags";
}

/** Writes the list back, adding `add` when it is not there; an empty list removes the key. */
function setList(fm: Record<string, unknown>, list: string[], add: string | null): void {
  const next = add && !list.some((t) => same(t, add)) ? [...list, add] : list;
  const key = keyOf(fm);
  if (next.length === 0) delete fm[key];
  else fm[key] = next;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
