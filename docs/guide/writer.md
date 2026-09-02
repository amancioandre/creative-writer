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

## Moving around

Drag the background to pan, wheel to zoom, **Fit** in the panel to see everything. Drag a card to place it; positions are kept relative to the group, so a card travels with its group. Groups **flow**: inside a layer they sit left to right and never overlap. Drag a group by its name or its empty area to change its place in the row, and drag the small square in its corner to resize it; the neighbours move along. Order and sizes are remembered in the writer file.

**Drop a card into another group and its tag follows.** The old tag is replaced by the new one, in the front matter if it lives there, in the text if it was inline. Drop it on the background and it just stays where you put it; the tag is untouched.

## Adding and removing cards

- **Add note…** in the panel opens a picker over the whole vault and tags the note into the group chosen in the dropdown beside it. A group's own card has *Add note here*.
- **New note…** creates a note with the tag already in place, in the [stories folder](/reference/settings#writer) if you set one, and opens it.
- Select a card and use **Remove** beside a group to take that tag off the note. The note itself is never touched beyond its tags.
- Tag a note by hand and it appears on the next refresh. A tag whose suffix matches no group lands in **Unsorted**, so nothing is lost when you switch frameworks.

## The panel

The sliders icon top-right folds the panel. It holds the framework dropdown (Truby, Generic, or yours if the file carries one), a search that dims everything but the matching cards, the group dropdown for new cards, **Add note…**, **New note…**, **Fit** and **Copy schema**, then three folded sections: which layers are shown, a colour per group, and the tag prefix.

**Copy schema** puts the [writer protocol](/reference/writer-file) on the clipboard: everything a person or a tool needs to prepare or migrate a board into your vault. The plugin ships no importer on purpose.

## Privacy

The board is the most private thing in the vault. Nothing on it is exported by the manuscript, written by the threads, logged by the desk, or put in a model prompt. It has no effect on the story map, and the story map none on it. It is read only back to you.

## What comes next

`REF` comments that count where a card is used, named lines between cards, voices and the reading list follow in the next releases. The [design note](/development/writer-design) has the order.
