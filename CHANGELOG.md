# Changelog

Release notes for every version are on the [releases page](https://github.com/amancioandre/creative-writer/releases). This file carries the same text for the versions since it was started.

## 0.8.0 — The writer

The writer is a fourth level above the sentence, the story and the vault: what the author is made of, and which stories they are carrying. This release ships the board and its protocol. Nothing on the page changes.

### The board

- **Open writer** (command, the dashboard ribbon icon, or opening `Writer.writer`) shows every note tagged `#writer/<group>` as a card inside the groups of a framework, layers stacked down the board: Truby's wish list, premises, inspirations, references and voices by default, or a Generic set, or one written into the writer file. Every group is drawn, with a hint while it is empty. A note in several groups is drawn once, with a chip per group; zoom in and cards show their first lines; lines join cards whose notes link.
- Pan, zoom, **Fit**; drag cards, move groups with their cards, resize groups from the corner. **Drop a card into another group and its tag follows**, in the front matter or inline, whichever the note uses.
- **Click a group and the board zooms to it**; click again, click away or press Escape and the board comes back. **The keyboard:** arrows move between groups and lanes (the stories band is the lane above the first layer), Shift+arrows between the cards of a group, Alt+←/→ carry a card into the neighbouring group with its tag, PgUp/PgDn and 1–9 jump lanes, Enter on a group opens the new-note form (Enter creates and stays, Ctrl+Enter creates and opens), Enter on a card opens the note, Delete takes a card out of its group, `f` fits, `z` fits the selection, `/` finds, `p` folds the panel, `?` lists them all. Tab is never taken and Ctrl/Cmd stay with Obsidian; the moves are commands too, so they can be rebound.
- The panel: framework, search, a group for new cards, **Add note…** (a picker over the vault), **New note…** (a tagged note, created where Obsidian puts new notes), colours per group, layers to hide, the tag prefix. A card's side panel opens the note, removes it from a group, adds it to another, and lists the cards it links to.
- Layout, colours and the view go to one `Writer.writer` file, found by extension, created in the stories folder on first save. Obsidian Sync carries it with *Sync all other types* on; the docs say so first.
- The board follows the vault: a tag added by hand appears on the next metadata pass, a renamed note keeps its place.

### The stories band

- Every declared project sits above the layers as a story card: name, stage, premise, and one line with words against the target, the cast and the last day the log saw it change. The side card sets the stage (`writing-stage`, or inferred from prose and the target), opens the map, timeline, threads, manuscript and desk for that project, and links to the idea it grew from.
- **Idea** pills are premise cards with no story yet; **Make this a story…** scaffolds a folder (or copies one marked `story-template: true`, with `{{name}}` replaced), writes `story: true`, the stage, the premise and `writing-idea` into the project note, and `writer-story` into the idea, which stays where it is. **New story…** in the panel starts from nothing.
- **Unfiled** pills are folders under the stories folder with prose and no declaration; **Declare a story** writes `story: true` into the folder's namesake or first note.

### Uses and lines

- A story **uses** a card when a note in its folder links to it, by wikilink or by a `%% REF: [[Card]] %%` comment. **Reference a writer card** drops one at the cursor from a picker; `REF` is now a built-in comment tag. Cards show how many stories use them, a card in two or more is marked **recurring**, a card's side card lists the stories, a story's lists what it draws on.
- **Named lines.** Click a line between linked cards, or *Name…* beside a link, and give it a name and a colour; a pair may carry several. Names live in the writer file and go dashed when the notes stop linking.
- A test pins the privacy rule: a REF comment never reaches the prose a model reading is built from.

### Voices, fingerprints, reading

- A story adopts a **voice** (a card in the Voices group) from its side card, written as `writing-voice`; the voice's side card lists its adopters.
- Every story with prose shows a **fingerprint**: reading ease, grade, sentence variety and dialogue share over its prose notes. A voice card blends the fingerprints of the stories that adopted it, so the voice on the page can be checked against the voice on the card.
- Reading cards carry `reading: to-read | reading | read`, set from the side card, shown as a chip; a linked craft note is offered as the analysis.
- The myth report's archetypes gain **Add to writer**: a REF to an existing archetype card, or a new tagged archetype note with the evidence.

### The protocol

- **Copy writer schema** puts the [writer protocol](docs/reference/writer-file.md) on the clipboard for your vault's framework and tag prefix: which `#writer/<group>` tags make a note a card, the project-note keys, the `%% REF: [[Card]] %%` comment, and the `Writer.writer` file format. Paste it to a person or a tool migrating a board into the vault; the plugin ships no importer on purpose.
- Two frameworks, both macro rather than per-story: **Truby** (wish list, premises, inspirations, references, voices) and **Generic**. Your own can be written into the writer file.
- **Settings → Writer → Stories folder**: where ideas are scaffolded, new cards go and the writer file is created.
- The domain for the board (frameworks, tags, the writer file, the board, uses) is in place and tested; the view follows in the next phase.

## 0.7.2 — Review housekeeping

Fixes for the community plugin review of 0.7.1. Nothing changes on the page.

- The manuscript comment field and its popover set their inline sizes through the Obsidian style helper rather than writing styles directly, which the review flags.
- The dashed underline on a candidate name in a cast line uses the long-hand text-decoration properties, which older Obsidian builds render more reliably than the shorthand.
- Redundant type assertions in the threads view and manuscript settings are gone.
- The README no longer carries placeholder media, a placeholder video link or an unset sponsorship badge.

## 0.7.1 — After the first pass

Small corrections from using the manuscript page for a day.

- Selecting a paragraph on the manuscript page opens the note beside the page when no editor shows it (the editor beside the page swaps its file, or a split opens), still without taking focus. 0.7.0 only followed in an editor that was already open.
- A click or Enter on a comment row takes the page to that paragraph, the editor following, focus staying in the list; a double click or Shift+Enter goes into the editor at the comment. The same for a contradiction row and the other scene.
- A candidate in a cast line (a name the map found without a note) opens a menu on click: make it a character, place, item, faction or event note, or say it is not a name.
- The story map, timeline, threads and manuscript tabs are named after the feature only. The project name in the tab was set once and went stale, showing "Blank" or the last project opened.

## 0.7.0 — The manuscript

The whole story on one page, read-only, with the folder tree as its outline, a comments pane, and the rest of the plugin folded onto it.

### Manuscript view

- **Open manuscript** (command, or the book ribbon icon) opens the project's prose stitched in manuscript order beside the editor. Folders become eyebrow headings, note names become titles (a note whose first heading repeats its name shows it once), the headings inside a note nest under the outline, and sort prefixes like `01 -` are stripped. Typed notes, the plugin's own notes, notes with `manuscript: false` and notes with no prose stay off the page.
- **Select, then edit.** A click or the arrow keys select a paragraph; an editor already showing that note follows without taking focus. Enter or a double click goes into the editor at that sentence. Alt+Up/Down jump chapters, Home and End go to the extremes. **Return to manuscript** brings focus back from the editor to the paragraph the cursor is in.
- **Follows your typing.** A chapter edited beside the page redraws alone after a moment, unsaved text included; the scroll position and the selection stay put; a hidden tab waits.
- **Prose only** hides lists, tables, code and callouts. **Export** writes the page as `<Name> (manuscript).md` beside the project, comments left out, flagged so it is never read back.

### Comments and tags

- `%% comments %%` show as dots in the gutter, in a box on hover or keyboard focus, and in a pane beside the page: the selected paragraph's comments, and every comment of the manuscript in reading order, filterable by tag, keyboard navigable.
- **One field to write one.** Type `CHECK: was it a coat in chapter three?` and press Enter; the comment lands at the end of that paragraph in the note, through the open editor if there is one. The tag is read from the prefix and shown as a chip while typing. Press `c` on the page to get to the field.
- **Tags** colour comments on the page and the tag word in the editor: `TODO`, `FIX`, `CHECK`, `IDEA`, `CUT` by default, editable in settings. **Insert comment here** drops `%%  %%` at the cursor, or wraps a selection as a highlight with the comment after it.

### The rest of the plugin on the page

- **The ruler** at the top is the shape of the book: one segment per section, wide by words, coloured by the desk's reading-ease bands, underlined when the section changed today, dotted when it has comments. Click or arrow to go there.
- **Story** lays the map over the page: a cast line under each section, the scene's cast in the pane, in the map's colours; the threads view's contradictions as red diamonds in the gutter, with the clash in the hover box and the pane and a click to the other scene. Off by default, since it builds the map on every refresh.

### Elsewhere

- Clicking a scene in the timeline or threads reuses an editor already showing the note and never replaces the view it was clicked in.
- Settings → Manuscript: outline depth, note titles, what to strip from names (presets or a pattern), nesting, prose only, the comments pane, tag tinting, the tag list, the ruler, the story.
- New front matter: `manuscript: true|false`. New data note flag: `creative-writer-manuscript` on the export.
