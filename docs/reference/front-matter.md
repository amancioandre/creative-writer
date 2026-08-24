# Front matter

Every property the plugin reads or writes. All are optional.

## Any note

| Key | Values | Effect |
|---|---|---|
| `creative-writer` | `true` / `false` | Force the editor features on or off for this note, whatever the *Notes* mode says. `false` also keeps the note out of the [story map](/guide/story-map#what-is-read) and timeline — the right line for memos, research and reviews. Written by *Toggle Creative Writer for this note*. |

## Project note

The note whose front matter declares a [project](/guide/projects). Any note in the folder can be it.

| Key | Values | Effect |
|---|---|---|
| `writing-target` | words, e.g. `80000` | Makes the note's folder a project. Required for everything else here. |
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
creative-writer-storymap: 1
---
```

followed by a short explanation and one ```` ```json ```` block of model readings. The flag keeps the plugin from reading its own note as a chapter. Safe to delete — you would re-run the reading.
