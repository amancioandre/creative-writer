import { UNSORTED, groupId } from "./Framework";

/**
 * A note joins the board by carrying a nested tag under the prefix:
 * `#writer/theme`, or `tags: [writer/theme, writer/quote]` in front matter.
 * One word per group, several groups per note, no note required to point
 * at, visible in Obsidian's tag pane. The tag has no effect on any other
 * feature of the plugin.
 */
export const DEFAULT_PREFIX = "writer";

/** Lowercase, no `#`, no slashes; the default when nothing usable is given. */
export function normalizePrefix(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_PREFIX;
  const p = raw.trim().replace(/^#+/, "").replace(/\//g, "").toLowerCase();
  return p || DEFAULT_PREFIX;
}

/** The tag to write for a group, without `#`. */
export function writerTag(prefix: string, group: string): string {
  return `${prefix}/${group}`;
}

/**
 * The group ids a note's tags put it in, in tag order, deduplicated.
 * `#writer/theme/dark` is the `theme` group; a bare `#writer` is Unsorted.
 * Case does not matter. Tags outside the prefix are ignored.
 */
export function groupsFromTags(tags: Iterable<string>, prefix: string = DEFAULT_PREFIX): string[] {
  const want = prefix.toLowerCase();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const parts = raw.trim().replace(/^#+/, "").split("/");
    if ((parts[0] ?? "").toLowerCase() !== want) continue;
    const id = parts.length > 1 ? groupId(parts[1]!) : "";
    const group = id || UNSORTED.id;
    if (!out.includes(group)) out.push(group);
  }
  return out;
}

/** Whether any tag is under the prefix at all. */
export function hasWriterTag(tags: Iterable<string>, prefix: string = DEFAULT_PREFIX): boolean {
  return groupsFromTags(tags, prefix).length > 0;
}
