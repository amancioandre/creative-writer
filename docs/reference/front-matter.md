# Front matter

Every property the plugin reads or writes. All are optional.

## Any note

| Key | Values | Effect |
|---|---|---|
| `creative-writer` | `true` / `false` | Force the editor features on or off for this note, whatever the *Notes* mode says. `false` also keeps the note out of the [story map](/guide/story-map#what-is-read) and timeline — the right line for memos, research and reviews. Written by *Toggle Creative Writer for this note*. |
| `story-order` | number, e.g. `3` | Where this note falls in the manuscript. Notes with it come first, by number; the rest follow in path order. Used by the story map, timeline and [threads](/guide/story-threads#the-axis). |

## Project note

The note whose front matter declares a [project](/guide/projects). Any note in the folder can be it.

| Key | Values | Effect |
|---|---|---|
| `writing-target` | words, e.g. `80000` | Makes the note's folder a project with a word goal. |
| `story` | `true` | Makes the note's folder a project with **no** goal — a book you are reading and mapping, or a map sketched before the draft. The story map and timeline see it; the writing desk does not. Either key is enough; `writing-target` adds the goal on top. |
| `writing-deadline` | `YYYY-MM-DD` | Pace and verdict against a date. |
| `writing-daily` | words, e.g. `500` | A per-project daily goal with its own streak. |
| `writing-name` | text | Display name instead of the folder name. |
| `writing-scope` | `note` | Count only this note, not the folder. |
| `story-ignore` | list or comma string | Capitalised words the story map must not turn into candidates. Written by the map's *Not a name*; edit freely. |

## Entity notes

Notes that are people, places and things in the story.

| Key | Values | Effect |
|---|---|---|
| `type` (or `kind`, `entity`) | `character`, `person`, `location`, `place`, `setting`, `item`, `object`, `artifact`, `faction`, `organisation`, `house`, `event`… | The node's kind. A folder named `Characters/`, `Places/`, `Items/`, `Factions/`, `Events/` (and synonyms) types its notes without this key; the key wins over the folder. |
| `aliases` | list or string (Obsidian's own property) | Other names the prose uses: `[Marti, M.]`. Written by the map's *Alias of…*. |
| `name` | text | Treated as an extra alias. |

Created by the map's *Character · Place · Item · Faction · Event* exits as:

```yaml
---
type: item
aliases: []
---
```

## Writing log note

`Creative Writer/Writing log.md` (or the path in Settings → Goals) carries `creative-writer: false` and `creative-writer-log: 1`, a line of explanation and one JSON block. Safe to edit; deleting it starts the log afresh.

## Story map data note

`Story map.md` in the project folder is written by the plugin and carries:

```yaml
---
creative-writer: false
creative-writer-storymap: 2
---
```

followed by a short explanation and one ```` ```json ```` block: relation readings and fact readings per scene, contradictions you dismissed, and pinned node positions. The flag keeps the plugin from reading its own note as a chapter; a version-1 note (before facts existed) loads as is. Safe to delete — you would re-run the readings.

## Story threads note

`Story threads.md` in the project folder is yours: the [threads you draw by hand](/guide/story-threads#drawing-threads-yourself). The plugin creates it on the first *Add to a thread* with

```yaml
---
creative-writer: false
creative-writer-threads: 1
---
```

and adds one `## heading` per thread and one `- [[Note#Heading]] — note` line per scene. Edit it freely, or write it from scratch without the front matter — a note named `Story threads` is never read as a chapter either way.
