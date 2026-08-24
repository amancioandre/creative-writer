import type { EntityKind } from "./StoryGraph";

/** What the index needs to know about a note: its front matter and where it sits. */
export interface EntityNote {
  readonly path: string;
  readonly frontmatter: unknown;
}

export interface IndexedEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: EntityKind;
  readonly path: string;
  readonly aliases: readonly string[];
}

const KIND_BY_TYPE: Record<string, EntityKind> = {
  character: "character", person: "character", people: "character", npc: "character", protagonist: "character", antagonist: "character",
  location: "location", place: "location", setting: "location", world: "location", region: "location", city: "location",
  item: "item", object: "item", artifact: "item", artefact: "item",
  faction: "faction", organisation: "faction", organization: "faction", house: "faction", group: "faction",
  event: "event",
};

/** Folder names that declare their contents' kind, so a `Characters/` folder needs no front matter. */
const KIND_BY_FOLDER: ReadonlyArray<[RegExp, EntityKind]> = [
  [/^(characters?|people|cast|dramatis personae|npcs?)$/i, "character"],
  [/^(places?|locations?|settings?|world(building)?|geography|maps?)$/i, "location"],
  [/^(items?|objects?|artifacts?|artefacts?)$/i, "item"],
  [/^(factions?|organisations?|organizations?|houses|groups)$/i, "faction"],
  [/^(events?|timeline|history)$/i, "event"],
];

/** `type:` in front matter wins; otherwise the nearest enclosing folder name; otherwise it is a plain note. */
export function entityKindOf(note: EntityNote): EntityKind {
  const fm = asRecord(note.frontmatter);
  const declared = fm["type"] ?? fm["kind"] ?? fm["entity"];
  if (typeof declared === "string") {
    const k = KIND_BY_TYPE[declared.trim().toLowerCase()];
    if (k) return k;
  }
  const parts = note.path.split("/");
  for (let i = parts.length - 2; i >= 0; i--) {
    for (const [re, kind] of KIND_BY_FOLDER) if (re.test(parts[i]!)) return kind;
  }
  return "note";
}

export function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

/** Obsidian's own `aliases:` (string or list) plus a `name:` override. */
export function aliasesOf(frontmatter: unknown): string[] {
  const fm = asRecord(frontmatter);
  const out: string[] = [];
  const push = (v: unknown) => { if (typeof v === "string" && v.trim()) out.push(v.trim()); };
  push(fm["name"]);
  const raw = fm["aliases"] ?? fm["alias"];
  if (Array.isArray(raw)) raw.forEach(push);
  else push(raw);
  return [...new Set(out)];
}

/**
 * Looks names up by surface form. Full names (with or without a leading
 * article) first, then a unique surname or given name; "Marta" resolves
 * to "Marta Kovács" as long as there is no other Marta in the cast.
 */
export class NameLookup<T> {
  private readonly byName = new Map<string, T>();
  private readonly byWord = new Map<string, T[]>();

  add(label: string, value: T): void {
    const key = normalise(label);
    this.byName.set(key, value);
    if (key.startsWith("the ")) this.byName.set(key.slice(4), value);
    const words = key.split(" ");
    if (words.length > 1) for (const w of words) {
      if (w.length < 2 || PARTICLES.has(w)) continue;
      const bucket = this.byWord.get(w) ?? [];
      if (!bucket.includes(value)) bucket.push(value);
      this.byWord.set(w, bucket);
    }
  }

  /** The value a surface form denotes, or null when unknown or ambiguous. */
  resolve(surface: string): T | null {
    const key = normalise(surface);
    const exact = this.byName.get(key) ?? (key.startsWith("the ") ? this.byName.get(key.slice(4)) : undefined);
    if (exact !== undefined) return exact;
    const partial = this.byWord.get(key);
    return partial && partial.length === 1 ? partial[0]! : null;
  }
}

/** The project's cast, places and things, resolvable from prose. */
export class EntityIndex {
  private readonly lookup = new NameLookup<IndexedEntity>();
  readonly entities: readonly IndexedEntity[];

  constructor(notes: readonly EntityNote[]) {
    const list: IndexedEntity[] = [];
    for (const n of notes) {
      const kind = entityKindOf(n);
      if (kind === "note") continue;
      const name = basenameOf(n.path);
      const aliases = aliasesOf(n.frontmatter).filter((a) => a !== name);
      const e: IndexedEntity = { id: n.path, name, kind, path: n.path, aliases };
      list.push(e);
      for (const label of [name, ...aliases]) this.lookup.add(label, e);
    }
    this.entities = list;
  }

  resolve(surface: string): IndexedEntity | null {
    return this.lookup.resolve(surface);
  }

  /** Is this surface form known at all — as a name, alias or unique name part? */
  knows(surface: string): boolean {
    return this.resolve(surface) !== null;
  }
}

const PARTICLES = new Set(["of", "the", "de", "da", "do", "di", "van", "von", "der", "den", "la", "le", "del", "y", "e", "and"]);

export function normalise(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/['’ʼ‘]s$/u, "").replace(/\s+/g, " ").trim();
}

function asRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
}
