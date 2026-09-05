# Writer

The writer is the level above every story: what you are made of, and what you keep returning to. Its board is a collage. The vault is your brain; the board shows only the notes you placed on it, grouped by a framework, so the shape of your own preoccupations is visible before any one story is.

Open it with **Open writer**, the dashboard ribbon icon, or by opening `Writer.writer` in the file explorer.

::: tip Set up sync first
The board's layout lives in one `Writer.writer` file. Obsidian Sync carries it only with **Sync all other types** on, in *Settings → Sync → Selective sync*. Without it the board still works on each machine, because everything on it comes from your notes; only positions, colours and edge names differ between machines. See [Files & sync](/reference/data-and-sync).
:::

## What is on the board

- **Layers** run top to bottom, and hold **groups**: rounded regions with a name, a colour and, while they are empty, a hint about what belongs there. The default framework is Truby's: a *Wish list* (genres, plots, themes, archetypes, worlds, dialogues), *Premises*, *Inspirations* (poems, notes, music, videos, sentiments, quotes), *References* (craft, research, reading) and *Voices*. Every group is always shown; the structure teaches what to collect.
- **Cards** are your notes. A note is on the board when it carries a tag under the prefix, `#writer/theme` inline or `tags: [writer/theme]` in its front matter. A note in several groups is drawn once, in its first, with a colour chip per group. Zoom in past about 85% and each card shows its first lines.
- **Lines** join cards whose notes link to each other. Select a card and its lines light up.

The frameworks are deliberately *macro*. Save the Cat and the Hero's Journey structure one story; the writer level sits beneath every story. Story-level structure stays where it lives: the project folder, the [story map](/guide/story-map), the [timeline](/guide/story-timeline) and the [threads](/guide/story-threads).

## The stories band

Above the layers sits every declared [project](/guide/projects) as a story card: its name, a **stage** chip, the premise, and one line with words against the target, the size of the cast and the last day the writing log saw it change. Most recently worked first. Select a story and the side card offers the stage, buttons into its map, timeline, threads, manuscript and desk, the note itself, and the idea it grew from.

**Stages** are `development`, `drafting`, `revising`, `finished` and `shelved`, set from the side card and written as `writing-stage` in the project note. Leave it unset and the plugin infers: *finished* once the target is met, *drafting* once any prose exists, *in development* before. The premise comes from `writing-premise`; the idea link from `writing-idea`.

Below the cards, two kinds of pill:

- **Idea** pills are premise cards with no story yet. Select one and its side card offers **Make this a story…**: a name, a folder (the [stories folder](/reference/settings#writer) by default), and Create. A folder is scaffolded with Characters, Places, Items, three acts, `_Work`, and a project note carrying `story: true`, the stage, the premise (the idea's first sentence) and a link back to the idea; the idea note gets `writer-story` and stays where it is, tag and all. If any note in the vault carries `story-template: true`, its folder is copied instead, with `{{name}}` replaced in file names and text. **New story…** in the panel does the same from nothing.
- **Unfiled** pills are folders directly under the stories folder that hold prose but declare no project, so the map, timeline, threads and desk cannot see them. Select one and **Declare a story** writes `story: true` into its namesake note, or its first note.

## Uses and lines

A story **uses** a card when any note in its folder links to it. A plain `[[wikilink]]` counts. So does a comment:

```markdown
%% REF: [[Invictus]] %%
```

**Reference a writer card** in the editor picks a card and drops that comment at the cursor. Like every comment it stays off the [manuscript](/guide/manuscript) page and out of any export, and `REF` is a built-in comment tag with its own colour. Each card shows how many stories use it; a card used by two or more is **recurring**, the simplest picture of what you keep returning to. A card's side card lists the stories, and a story's side card lists what it **draws on**.

**Lines** join cards whose notes link. Click one, or *Name…* beside a linked card, and give it a name: *inspired by*, *contradicts*, *same theme*, *adopted*, or your own words, with a colour. A pair may carry several names. A line only lives between notes that link; remove the link and the line goes dashed until you restore it or remove the name. Names and colours live in the writer file.

## Voices and the fingerprint

A **voice** is a card in the Voices group: a narrator persona you have built. A story adopts one from its side card under *Voice*, which writes `writing-voice` into the project note. The voice's own side card lists the stories that adopted it.

Every story with prose carries a **fingerprint**: reading ease, grade level, sentence-length variety and the share of words inside dialogue, measured over its prose notes. It sits on the story card and in its side card. A voice card shows the fingerprints of the stories that adopted it and the blend of them, weighted by words, so you can see whether the voice on the page matches the voice on the card.

## The reading list

A card in the Reading group may carry a status, `reading: to-read`, `reading` or `read`, set from its side card and shown as a chip on the board. When the note links to a card in the Craft group, the side card points at that analysis.

## From the myth analysis

The [myth and archetype](/guide/myth) report gains **Add to writer** on every archetype it finds: attach it to an archetype card as a `REF` at the cursor, or make it a new archetype note where Obsidian puts new notes, tagged and holding the model's evidence. The flow is one way, story to writer; the board never feeds the model.

## Moving around

Drag the background to pan, wheel to zoom, **Fit** in the panel to see everything. Drag a card to place it; positions are kept relative to the group, so a card travels with its group. Groups **flow**: inside a layer they sit left to right and never overlap. Drag a group by its name or its empty area to change its place in the row, and drag the small square in its corner to resize it; the neighbours move along. Order and sizes are remembered in the writer file.

**Drop a card into another group and its tag follows.** The old tag is replaced by the new one, in the front matter if it lives there, in the text if it was inline. Drop it on the background and it just stays where you put it; the tag is untouched.

**Click a group and the board zooms to it**, close enough that its cards show their first lines. Click it again, click the background, or press Escape, and the whole board comes back.

## The keyboard

Click anywhere on the board and the keys work; press `?` for the list on the board itself. Lanes are the layers, read top to bottom, with the stories band above the first. Tab is never taken: it moves the focus as it does everywhere in Obsidian, and Ctrl and Cmd stay with Obsidian's own hotkeys.

| Key | Does |
|---|---|
| `←` `→` `↑` `↓` | Move between groups and zoom to each. Left and right walk the row; up and down cross lanes to the nearest group. Up from the first layer reaches the stories; there, left and right walk the stories, the idea pills and the unfiled pills. |
| `Shift` + arrows | Move between the cards inside the group, in reading order. |
| `Alt` + `←` `→` | Move the selected card into the neighbouring group; its tag follows, as a drop would. |
| `PgUp` `PgDn` · `1`–`9` · `s` | A lane up or down; a lane by number; the stories. |
| `Home` `End` | The first or last group of the row. |
| `Enter` | On a group: the new-note form. On a card or a story: open the note. |
| `n` · `N` · `a` | New note here · New story · Add an existing note here, through the picker. |
| `Delete` | Take the card out of this group: the tag comes off, the note stays. |
| `f` · `z` · `+` `−` | Fit the board · Fit the selection · Zoom. |
| `/` · `p` · `?` | Find a card · Fold the panel · The list of keys. |
| `Esc` | Close the form, then step back from a card to its group, then clear the selection and fit the board. |

In the new-note form, **Enter creates the note and stays on the board** with the new card selected, so you can keep collecting; **Ctrl+Enter** creates it and opens it. Escape returns to the group.

The lane and group moves, the new note, the fit and the list are also commands (*Writer: next lane* and so on), live while the board is the active tab, so they can be given hotkeys in Settings → Hotkeys.

## Adding and removing cards

- **Add note…** in the panel opens a picker over the whole vault and tags the note into the group chosen in the dropdown beside it. A group's own card has *Add note here*.
- **New note…** creates a note with the tag already in place and selects its card; Ctrl+Enter in the form opens it too. The note goes where Obsidian puts new notes, *Settings → Files and links → Default location for new notes*, so a card is a note like any other.
- Select a card and use **Remove** beside a group to take that tag off the note. The note itself is never touched beyond its tags.
- Tag a note by hand and it appears on the next refresh. A tag whose suffix matches no group lands in **Unsorted**, so nothing is lost when you switch frameworks.

## The panel

The sliders icon top-right folds the panel. It holds the framework dropdown (Truby, Generic, or yours if the file carries one), a search that dims everything but the matching cards, the group dropdown for new cards, **Add note…**, **New note…**, **Fit** and **Copy schema**, then three folded sections: which layers are shown, a colour per group, and the tag prefix.

**Copy schema** puts the [writer protocol](/reference/writer-file) on the clipboard: everything a person or a tool needs to prepare or migrate a board into your vault. The plugin ships no importer on purpose.

## Privacy

The board is the most private thing in the vault. Nothing on it is exported by the manuscript, written by the threads, logged by the desk, or put in a model prompt. It has no effect on the story map, and the story map none on it. It is read only back to you.

## Design

The [design note](/development/writer-design) records the decisions and the departures from them.
