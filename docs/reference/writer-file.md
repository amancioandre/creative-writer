# The writer protocol

The **writer** is the plugin's fourth level, above the sentence, the story and the vault: what the author is made of, and which stories they are carrying. Its board is a *collage*. The vault is the writer's brain; the board shows only the notes the writer placed on it, grouped by a framework, beside every declared story project. The board owns nothing but layout.

This page is the protocol: what a note, a project note and the writer file contain for the board to read them. It is written so that you, or a tool you point at your vault, can prepare a vault or migrate an existing board (a canvas, a spreadsheet, a pile of notes) without an importer. **Copy writer schema** puts the same text, for your vault's current framework and prefix, on the clipboard.

::: info Arriving in steps
The protocol, the settings and the command ship first, so a vault can be prepared now. The board view, the stories row, promotion and REF counting follow in the next releases. See [the design note](/development/writer-design) for the order.
:::

## 1. Cards: a tag on any note

A note anywhere in the vault becomes a card by carrying a nested tag under the prefix (default `writer`), inline or in front matter:

```yaml
---
tags: [writer/theme, writer/quote]
---
```

- A note may carry several groups. A McCarthy line can be a `quote` and a `craft` reference.
- A tag whose suffix matches no group of the active framework goes to **Unsorted**, so nothing is lost when frameworks change. A bare `#writer` does too.
- The tag changes nothing else. It does not opt the note out of the story map or the word count; `creative-writer: false` still does that, separately. A card inside a project folder is still that project's note.
- Do not move notes to declare them, and do not create a folder for the board.

### Truby, the default framework

| Tag | Layer / Group | What belongs there |
|---|---|---|
| `#writer/genre` | Wish list / Genres | The genres and blends you would love to write in. |
| `#writer/plot` | Wish list / Plots | Plot shapes that keep pulling you: the quest, the confession, the return. |
| `#writer/theme` | Wish list / Themes | What you argue about, story after story. One sentence each. |
| `#writer/archetype` | Wish list / Archetypes | The people you keep writing: the lone hunter, the mentor at peace. |
| `#writer/world` | Wish list / Worlds | Places and milieus you return to. |
| `#writer/dialogue` | Wish list / Dialogues | Fragments of speech that arrived before any scene. |
| `#writer/premise` | Premises | One-line story questions. Promote one when it has a home. |
| `#writer/poem` | Inspirations / Poems | Poems that move you. |
| `#writer/note` | Inspirations / Notes | Personal notes: a creed, a thing someone said. |
| `#writer/music` | Inspirations / Music | Songs and their lines. |
| `#writer/video` | Inspirations / Videos | Films, talks, moments on a screen. |
| `#writer/sentiment` | Inspirations / Sentiments | Feelings and concepts you circle: pride, eudaimonia, a motto. |
| `#writer/quote` | Inspirations / Quotes | Lines from books, with the page. |
| `#writer/craft` | References / Craft | Analyses of other writers' work: what teaches you. |
| `#writer/research` | References / Research | Research that outlives one story. |
| `#writer/reading` | References / Reading | The reading list. `reading: to-read`, `reading` or `read` on the note. |
| `#writer/voice` | Voices | Narrators you have built and might adopt again. |

The frameworks are deliberately *macro*. Save the Cat and the Hero's Journey structure one story at a time; the writer level sits beneath every story. Story-level structure stays in the project folder, the [story map](/guide/story-map) and the [threads](/guide/story-threads).

### Generic

Themes, Characters (`archetype`), Worlds, Ideas (`premise`), Inspirations (`inspiration`), References (`reference`), Voices. The same tag suffixes where the meaning overlaps, so switching frameworks keeps most cards in place.

### Your own

Write it into the writer file (below). Group ids are lowercase letters, digits and hyphens, and double as tag suffixes.

## 2. Stories: declared projects

A story is a folder with a [project note](/guide/projects), as everywhere in the plugin. The board reads these keys on the project note, all optional:

| Key | Values | Meaning |
|---|---|---|
| `writing-stage` | `development` · `drafting` · `revising` · `finished` · `shelved` | Where the story is. Without it, `drafting` is inferred once prose exists and `finished` once the target is met. |
| `writing-premise` | one sentence | The story question, shown on the story card. |
| `writing-idea` | `"[[Idea note]]"` | The premise card this story grew from. |
| `writing-voice` | `"[[Voice note]]"` | The narrator persona the story adopts. |

An **idea** is a card in the `premise` group with no story yet. When it becomes one, the idea note gains `writer-story: "[[Project note]]"` and stays where it is, tag and all.

## 3. Uses: links and REF comments

A story *uses* a card when any note in its folder links to the card. A plain `[[wikilink]]` counts. So does

```markdown
%% REF: [[Invictus]] %%
```

a [comment](/guide/manuscript#comments) form that keeps the link off the manuscript page and out of any export, because comments never reach the reader. A card used by two or more stories is *recurring*. The plugin never writes REF comments by itself.

## 4. The writer file

One file per vault, `Writer.writer`, JSON with its own extension so that opening it opens the board, as `.canvas` does. The plugin finds it by extension, so there is no path setting; the first *Open writer* creates it in the stories folder (Settings → Writer) or at the vault root. It holds only what the notes cannot. Everything in it is optional; a missing or empty file still gives a full board.

```json
{
  "version": 1,
  "framework": "truby",
  "prefix": "writer",
  "colours": { "theme": "#7a9e7e" },
  "groups": { "theme": { "x": -2600, "y": -500, "w": 460, "h": 760 } },
  "cards": { "notes/My 7 words.md": { "x": -2240, "y": -2600 } },
  "edges": [
    { "from": "sources/poems/Invictus.md", "to": "notes/Courage.md", "label": "inspired by", "colour": "#c9a44c" }
  ],
  "view": { "x": 0, "y": 0, "k": 0.35 }
}
```

| Field | Meaning |
|---|---|
| `version` | `1`. |
| `framework` | `"truby"`, `"generic"`, or an inline `{ "name": "Mine", "layers": [ { "name": "…", "groups": [ { "id": "spark", "name": "Sparks", "colour": "#c9a44c", "hint": "…" } ] } ] }`. |
| `prefix` | The tag prefix, default `writer`. |
| `colours` | Group id → hex colour, overriding the framework's. |
| `groups` | Group id → `{ x, y, w, h }`: its size, and its order among the groups of its layer by `x`. Groups flow left to right inside a layer and never overlap, so `x` and `y` are recomputed on every draw; only the order and the size are kept. |
| `cards` | Note path → `{ x, y }`: where the card sits, **relative to the top-left corner of its group**, so it travels with the group. Unplaced cards are laid out in the group's grid automatically. |
| `edges` | Named lines between two cards **whose notes link to each other**: `{ from, to, label, colour }`. An edge between notes that no longer link is drawn dashed and offered for removal. |
| `view` | `{ x, y, k }`: the last pan and zoom. |

Unknown or malformed fields are dropped on read; the file is rewritten whole on every save.

::: warning Obsidian Sync
Markdown syncs by default; a `.writer` file travels only when **Sync all other types** is on in *Settings → Sync → Selective sync*. Without it the board still works on each machine, because cards, stories and uses all come from the notes; only positions, colours and edge names differ between machines.
:::

## 5. Privacy

The board is the writer's most private thing. Nothing on it is exported by the manuscript, written by the threads, logged by the desk, or put in a model prompt. It has no effect on the story map, and the story map none on it. It is read only back to the vault owner.
