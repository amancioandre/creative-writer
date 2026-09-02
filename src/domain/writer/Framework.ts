/**
 * A framework is how the writer's board is grouped: layers of groups, each
 * group a tag suffix with a name, a colour and a hint for when it is empty.
 *
 * Frameworks here are deliberately *macro*. Save the Cat and the Hero's
 * Journey structure one story at a time; the writer level sits beneath
 * every story and asks what the author is made of. Truby's premise chapter
 * (wish list, premise list) is the default because it asks "what do you
 * care about?" rather than "what happens next?". Story-level structure
 * lives in the project folder, the story map and the threads, not here.
 */
export interface GroupDef {
  /** The tag suffix: `#writer/theme` is the `theme` group. Lowercase, letters, digits and hyphens. */
  readonly id: string;
  readonly name: string;
  /** Hex colour. */
  readonly colour: string;
  /** Shown in the empty slot so the structure teaches what to collect. */
  readonly hint: string;
}

export interface LayerDef {
  readonly name: string;
  readonly groups: readonly GroupDef[];
}

export interface Framework {
  /** A shipped id (`truby`, `generic`) or `custom` for one written into the writer file. */
  readonly id: string;
  readonly name: string;
  readonly layers: readonly LayerDef[];
}

/** Where a tag under the prefix lands when the active framework has no group for it. Never lost. */
export const UNSORTED: GroupDef = { id: "unsorted", name: "Unsorted", colour: "#8a8a8a", hint: "Tags under the prefix that match no group of this framework." };

const g = (id: string, name: string, colour: string, hint: string): GroupDef => ({ id, name, colour, hint });

export const TRUBY: Framework = {
  id: "truby",
  name: "Truby",
  layers: [
    {
      name: "Wish list",
      groups: [
        g("genre", "Genres", "#c98f3f", "The genres and blends you would love to write in."),
        g("plot", "Plots", "#b5653c", "Plot shapes that keep pulling you: the quest, the confession, the return."),
        g("theme", "Themes", "#7a9e7e", "What you argue about, story after story. One sentence each."),
        g("archetype", "Archetypes", "#5b8bb5", "The people you keep writing: the lone hunter, the mentor at peace."),
        g("world", "Worlds", "#6f9a8c", "Places and milieus you return to."),
        g("dialogue", "Dialogues", "#9a7bb0", "Fragments of speech that arrived before any scene."),
      ],
    },
    {
      name: "Premises",
      groups: [g("premise", "Premises", "#c25c5c", "One-line story questions. Promote one when it has a home.")],
    },
    {
      name: "Inspirations",
      groups: [
        g("poem", "Poems", "#b58fc9", "Poems that move you."),
        g("note", "Notes", "#a3a3a3", "Personal notes: a creed, a thing someone said."),
        g("music", "Music", "#5fa8a0", "Songs and their lines."),
        g("video", "Videos", "#7f8fc9", "Films, talks, moments on a screen."),
        g("sentiment", "Sentiments", "#c9a44c", "Feelings and concepts you circle: pride, eudaimonia, a motto."),
        g("quote", "Quotes", "#8ea36b", "Lines from books, with the page."),
      ],
    },
    {
      name: "References",
      groups: [
        g("craft", "Craft", "#6c8ebf", "Analyses of other writers' work: what teaches you."),
        g("research", "Research", "#8a9a5b", "Research that outlives one story."),
        g("reading", "Reading", "#b07d62", "The reading list. Put reading: to-read, reading or read on the note."),
      ],
    },
    {
      name: "Voices",
      groups: [g("voice", "Voices", "#d08c60", "Narrators you have built and might adopt again.")],
    },
  ],
};

export const GENERIC: Framework = {
  id: "generic",
  name: "Generic",
  layers: [
    {
      name: "What you are made of",
      groups: [
        g("theme", "Themes", "#7a9e7e", "What you argue about, story after story."),
        g("archetype", "Characters", "#5b8bb5", "The people you keep writing."),
        g("world", "Worlds", "#6f9a8c", "Places and milieus you return to."),
      ],
    },
    { name: "Ideas", groups: [g("premise", "Ideas", "#c25c5c", "Story questions waiting for a home.")] },
    { name: "Inspirations", groups: [g("inspiration", "Inspirations", "#b58fc9", "What moves you: poems, songs, notes, quotes.")] },
    { name: "References", groups: [g("reference", "References", "#6c8ebf", "What teaches you: analyses, research, the reading list.")] },
    { name: "Voices", groups: [g("voice", "Voices", "#d08c60", "Narrators you have built and might adopt again.")] },
  ],
};

export const FRAMEWORKS: readonly Framework[] = [TRUBY, GENERIC];
export const DEFAULT_FRAMEWORK = TRUBY;

export function frameworkById(id: string): Framework | null {
  return FRAMEWORKS.find((f) => f.id === id) ?? null;
}

/** Every group of a framework, in board order. */
export function groupsOf(framework: Framework): GroupDef[] {
  return framework.layers.flatMap((l) => l.groups);
}

/** A tag suffix as a group id: lowercased, anything but letters, digits and hyphens folded to a hyphen. */
export function groupId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColour = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/**
 * A framework written by hand into the writer file. Layers without a valid
 * group are dropped; a duplicate group id keeps its first definition; an
 * empty result is no framework at all.
 */
export function normalizeFramework(raw: unknown): Framework | null {
  const r = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!r || !Array.isArray(r.layers)) return null;
  const seen = new Set<string>([UNSORTED.id]);
  const layers: LayerDef[] = [];
  for (const rawLayer of r.layers as unknown[]) {
    const l = (rawLayer && typeof rawLayer === "object" ? rawLayer : {}) as Record<string, unknown>;
    const groups: GroupDef[] = [];
    for (const rawGroup of Array.isArray(l.groups) ? (l.groups as unknown[]) : []) {
      const o = (rawGroup && typeof rawGroup === "object" ? rawGroup : {}) as Record<string, unknown>;
      const id = typeof o.id === "string" ? groupId(o.id) : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : id;
      groups.push({ id, name, colour: isHexColour(o.colour) ? o.colour : UNSORTED.colour, hint: typeof o.hint === "string" ? o.hint.trim() : "" });
    }
    if (groups.length) layers.push({ name: typeof l.name === "string" && l.name.trim() ? l.name.trim() : `Layer ${layers.length + 1}`, groups });
  }
  if (!layers.length) return null;
  return { id: "custom", name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Custom", layers };
}
