# Front matter

Every property the plugin reads or writes. All are optional.

## Any note

| Key | Values | Effect |
|---|---|---|
| `creative-writer` | `true` / `false` | Force the editor features on or off for this note, whatever the *Notes* mode says. `false` also keeps the note out of the [story map](/guide/story-map#what-is-read), the plot grid, the threads and the manuscript page — the right line for memos, research and reviews. Written by *Toggle for this note*. |
| `story-order` | number, e.g. `3` | Where this note falls in the manuscript. Notes with it come first, by number; the rest follow in path order. Used by the story map, the [plot grid](/guide/plot-grid), the [threads](/guide/story-threads#the-axis) and the [manuscript](/guide/manuscript). |
| `manuscript` | `true` / `false` | `false` keeps a note off the [manuscript](/guide/manuscript) page: an outline, research, the project note itself. `true` puts a typed note (a character sheet, say) on it. Notes with no prose are never on it. |

## Project note

The note whose front matter declares a [project](/guide/projects). Any note in the folder can be it.

| Key | Values | Effect |
|---|---|---|
| `writing-target` | words, e.g. `80000` | Makes the note's folder a project with a word goal. |
| `story` | `true` | Makes the note's folder a project with **no** goal — a book you are reading and mapping, or a map sketched before the draft. The story map, the plot grid and the threads see it; the writing desk does not. Either key is enough; `writing-target` adds the goal on top. |
| `writing-deadline` | `YYYY-MM-DD` | Pace and verdict against a date. |
| `writing-daily` | words, e.g. `500` | A per-project daily goal with its own streak. |
| `writing-name` | text | Display name instead of the folder name. |
| `writing-scope` | `note` | Count only this note, not the folder. |
| `story-ignore` | list or comma string | Capitalised words the story map must not turn into candidates. Written by the map's *Not a name*; edit freely. |
| `plot-order` | list or comma string, e.g. `Time, POV, arcs, Plot point, themes, subplots, threads` | The grid's blocks left to right: a job column's heading, or a kind group's word. Written by a drag or Move left / right; blocks it leaves out follow in the default order. |
| `plot-pov`, `plot-time`, `plot-theme`, `plot-beats` | a heading from `Story threads.md`, e.g. `Theme: What we owe the dead` | Which thread the [plot grid](/guide/plot-grid) draws as its POV, Time, main theme and plot point columns. Written by a column's *Use as…* or a template's apply; edit freely. |
| `%% Name %%` right before a sentence of speech | a cast name, or `not speech` | Not front matter but the same kind of thing: the [speaker box](/guide/lenses#the-speaker-box)'s pin, a hidden comment naming who speaks the sentence after it. Written by the box; edit or delete it freely. |
| `bad-words` | `[[Bad words]]` or a path | The project's own word list for the [words lens](/guide/lenses#words): notes inside the project use it instead of the vault-wide note. |
| `dialogue` | `double`, `single`, `dash`, `none` | How speech is written in this project, for the [dialogue lens](/guide/lenses#dialogue); `quotes` and `travessão` are read too. Absent, the vault-wide setting. |
| `thoughts` | `italic-paragraph`, `italic-any`, `single-quotes`, `none`, or a regular expression | How thought is written in this project. Anything that is not a preset is taken as a pattern: every match in a paragraph is a thought. |
| `speakers` | list or comma string, e.g. `[Mara, Tomas #c8773a]` | The cast the [dialogue lens](/guide/lenses#who-is-speaking) attributes speech to, in this order; a name with no note is a speaker too; `#hex` pins a colour. Absent, every character note inside the project. |

## Entity notes

Notes that are people, places and things in the story.

| Key | Values | Effect |
|---|---|---|
| `type` (or `kind`, `entity`) | `character`, `person`, `location`, `place`, `setting`, `item`, `object`, `artifact`, `faction`, `organisation`, `house`, `event`… | The node's kind. A folder named `Characters/`, `Places/`, `Items/`, `Factions/`, `Events/` (and synonyms) types its notes without this key; the key wins over the folder. |
| `aliases` | list or string (Obsidian's own property) | Other names the prose uses: `[Marti, M.]`. Written by the map's *Alias of…*. |
| `name` | text | Treated as an extra alias. |
| `colour` (or `color`) | `"#c8773a"` | A character's speaker colour under the [dialogue lens](/guide/lenses#who-is-speaking). Absent, one from the palette in cast order. |
| `accent` | list or comma string | Words and phrases this character's speech uses, marked green inside their lines under the [accents lens](/guide/lenses#accents). |
| `accent-never` | list or comma string | Words this character never says, marked red inside their lines under the accents lens. |

Created by the map's *Character · Place · Item · Faction · Event* exits as:

```yaml
---
type: item
aliases: []
---
```

## Writing log note

`Creative Writer/Writing log.md` (or the path in Settings → Stories and goals) carries `creative-writer: false` and `creative-writer-log: 1`, a line of explanation and one JSON block. Safe to edit; deleting it starts the log afresh.

## Story map data note

`Story map.md` in the project folder is written by the plugin and carries:

```yaml
---
creative-writer: false
creative-writer-storymap: 4
---
```

followed by a short explanation and one ```` ```json ```` block: relation readings and fact readings per scene, the model's verdict per contradiction, sentence pairs the embedding model found alike, contradictions you dismissed, pinned node positions, and under a `grid` key the [plot grid](/guide/plot-grid#reading-with-the-model)'s readings, one per cell the model read, each with its state (open, dismissed, or none). The flag keeps the plugin from reading its own note as a chapter; a note from an earlier version (before facts, intents and echoes, or the grid existed) loads as is. Safe to delete — you would re-run the readings.

## Plot grid snapshot

| Key | Value | Effect |
|---|---|---|
| `creative-writer-grid-snapshot` | `1` | Written by **Snapshot the grid**, with `creative-writer: false`, so the table is never read back as a chapter. |

## Manuscript export note

`<Name> (manuscript).md` in the project folder is written by **Export** on the manuscript page and carries `creative-writer: false` and `creative-writer-manuscript: 1`, so it is never counted or read as a chapter. A snapshot; export again to refresh it.

## Outline note

`Outline.md` in the project folder is the [plot grid's plan](/guide/plot-grid#before-there-are-chapters-the-outline) before the chapters exist, created on the first **New scene** with

```yaml
---
creative-writer: false
creative-writer-outline: 1
---
```

and written as `#` act, `##` chapter, `###` scene, with an HTML comment under a scene as its logline. The flag keeps it out of the map, the threads and the manuscript page; the grid reads it for rows. **Build the manuscript** adds `creative-writer-outline-built: YYYY-MM-DD`, after which the grid reads it no more and the rows come from the chapter notes. Edit freely; delete it and the plan is gone, the built notes stay.

A comment, `<!-- … -->` or `%% … %%`, on one line or several, is never prose anywhere in the plugin: not a word counted, not a sentence read, not a heading if a heading is inside it.

## Template note

A note carrying `creative-writer-template: 1` in the templates folder (Settings → Stories and goals) is a [grid template](/guide/plot-grid#templates-a-starting-shape): `##` headings under `# Columns` are columns, the rest is the outline's grammar, and `plot-time`, `plot-pov`, `plot-theme` and `plot-beats` name the columns that get a job when it is applied; with `plot-beats`, the template's `beat:` tags fill that column with one stop per scene. `writing-name` gives it a display name. Written by **Save as template…**; edit freely.

## Story threads note

`Story threads.md` in the project folder is yours: the [threads you draw by hand](/guide/story-threads#drawing-threads-yourself). The plugin creates it on the first *Add to a thread* with

```yaml
---
creative-writer: false
creative-writer-threads: 1
---
```

and adds one `## heading` per thread and one `- [[Note#Heading]] — note` line per scene. A heading may carry a kind as its prefix, `## Arc: [[Anna]]`, `## Theme: …` or `## Subplot: …`; without one it is a free thread ([plot grid](/guide/plot-grid#reading-it)). A line may start with `plant:`, `touch:`, `payoff:` or `reversal:` and, under an arc, `want:`, `lie:`, `turn:` or `truth:`, and carry one `"quoted sentence"` as its anchor ([directed threads](/guide/story-threads#directed-threads)). The plot grid writes the same lines from its cells. Edit it freely, or write it from scratch without the front matter — a note named `Story threads` is never read as a chapter either way.

## Writer

The [writer board](/reference/writer-file) reads tags, not keys, to know which notes are on it: `tags: [writer/theme, writer/quote]` (or inline `#writer/theme`). A note may carry several. On a project note it reads, all optional:

| Key | Values | Effect |
|---|---|---|
| `writing-stage` | `development`, `drafting`, `revising`, `finished`, `shelved` | Where the story is on the board. Without it, `drafting` is inferred once prose exists and `finished` once the target is met. |
| `writing-premise` | one sentence | The story question on the story card. |
| `writing-idea` | `"[[Idea note]]"` | The premise card the story grew from. Written by promotion. |
| `writing-voice` | `"[[Voice note]]"` | The narrator persona the story adopts. |

On an idea note (a `writer/premise` card): `writer-story: "[[Project note]]"`, written by promotion. On a `writer/reading` card: `reading: to-read`, `reading` or `read`. The board view and these keys arrive in the releases after the protocol; nothing else in the plugin reads them.
