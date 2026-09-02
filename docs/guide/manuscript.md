# Manuscript

*The whole story on one page.* Every prose note of the project in reading order, stitched into one read-only page with the folder tree as its outline. Open it from the ribbon (the book icon) or with **Open manuscript**; it opens beside the current tab so the editor stays in view.

## Reading it

- **The outline** comes from your folders. `Part One/03 Chapter Three.md` reads as *Part One* › *Chapter Three*, with the sort prefix stripped. Folder names are small eyebrows above the chapter title, so the outline reads apart from the text.
- **Each note** gets its name as a heading, then its text as reading view would show it. A note whose first heading already is its name shows that heading once. The headings inside a note nest under the outline: a `# Camp` scene in a chapter in a part reads as level three.
- **Order** is manuscript order, the same the [story map](/guide/story-map), [timeline](/guide/story-timeline) and [threads](/guide/story-threads) use: notes by path, unless `story-order: 3` in a note's front matter says otherwise.
- **Selecting a paragraph** (a click, or the arrow keys) marks it and makes the editor follow to it without taking focus: the editor already showing that note, else the editor beside the page with its file swapped, else a new split. **Enter** or a **double click** goes into the editor at that sentence and puts the cursor there. Click a heading to open the note at its top. Links in the text work as they do anywhere.
- **Prose only**, in the toolbar, hides lists, tables, code and callouts and keeps paragraphs, headings, quotes and scene breaks (`***`).

The page follows your typing: edit a chapter in the editor beside it and that chapter redraws after a moment, the rest of the page untouched, the scroll position and the selection kept. A page in a hidden tab waits and redraws when it is shown. **Return to manuscript** (a command; give it a hotkey) brings you back from the editor to the paragraph the cursor was in.

## Keyboard

The page is one Tab stop; Tab and Shift+Tab move between the project list, the toolbar, the page, the comment field and the comment list.

| Key | Where | Does |
|---|---|---|
| Up / Down | page | previous / next paragraph |
| Alt + Up / Down | page | previous / next chapter |
| Home / End | page | first / last paragraph |
| Enter | page | edit this paragraph in the editor |
| c | page | write a comment on it |
| Enter | comment field | save the comment |
| Shift + Enter | comment field | new line |
| Escape | comment field, list | clear the field, then back to the page |
| Up / Down, Enter | comment list | move, open the editor on that comment |

## What is on the page

Only the story. These stay out:

- **Typed notes**: characters, places, items, factions, events, whether typed by `type:` in front matter or by a `Characters/`, `Places/`… folder.
- **The plugin's notes**: `Story map.md`, `Story threads.md`, the writing log.
- **Notes with `manuscript: false`** in their front matter: research, an outline, the project note when it is not the manuscript itself.
- **Notes with no prose**: a list of beats, an empty placeholder chapter.

`manuscript: true` puts a note on the page regardless of its type. The [scope rule](/guide/where-it-runs) applies first: a note the plugin does not count is not read at all.

## Comments and tags

Obsidian's `%% comments %%` are the right place for notes to self: they live in the text, sync with it, and never count as words. Reading view hides them; the manuscript page keeps them beside the text.

- **Marked paragraphs** carry a dot in the gutter per comment, in the tag's colour; a highlight is a small square. Hover the dot's paragraph for a moment, or move onto it with the keyboard, and its comments appear in a box.
- **The pane** (the speech-bubble toggle in the toolbar) has two parts. *This paragraph* shows the comments of the selected paragraph and one field: type `CHECK: was it a coat in chapter three?` and press **Enter**, and ` %% CHECK: was it a coat in chapter three? %%` lands at the end of that paragraph in the note, through the open editor if there is one. The tag is read from the prefix and shown as a chip while you type; no prefix means an untagged comment; Shift+Enter makes a new line. The chips under the field are a legend, and a click drops that prefix in. Press **c** on the page to jump to the field. *All comments* lists every comment and highlight of the manuscript in reading order, with the note each is in; the dropdown filters by tag, and Enter on a row opens the editor there.
- A comment on a line of its own (`%%` … `%%` as a block) belongs to the paragraph before it.
- **Tags** colour a comment by the word it opens with. An uppercase word and a colon, nothing else. The defaults are `TODO` (something still to write), `FIX` (prose known to be wrong), `CHECK` (continuity, facts, names), `IDEA` (a possibility) and `CUT` (kept only until you are sure); add your own under Settings → Manuscript → Tags. Deleting the comment is how a tag is resolved: there is no other state.
- **In the editor**, the tag word is tinted in the same colour, so a `TODO` stands out in the dimmed comment. Only inside `%%`: a TODO in dialogue is left alone.
- **Insert comment here** (a command) drops `%%  %%` at the cursor with the cursor inside. With a selection, the selection becomes a highlight and the comment follows it.

When the view is narrow the pane sits under the page instead of beside it.

## Settings

Settings → Manuscript: how many folder levels become headings, whether note names do, what to strip from names (numbers and separators, nothing, or a pattern of your own), whether the notes' own headings nest under the outline, prose only, the comments pane, tag tinting in the editor, and the tag list. See [Settings](/reference/settings#manuscript).

## The rest of the plugin on the page

The page is the one place with the whole book in view, so the other views lend it what they know.

- **The ruler** under the toolbar (the ruler toggle) is the shape of the book: one segment per section, wide by its word count, coloured from easy to dense by the same reading-ease bands as the [writing desk](/guide/writing-desk), underlined in the accent colour when the section changed today, a dot when it has comments. Hover a segment for the numbers, click it to go there; Left and Right walk it.
- **Story** (the people toggle) lays the [story map](/guide/story-map) over the page: a cast line under each section title, everyone in it in the map's colours, most mentioned first; *In this scene* in the pane for the selected paragraph; a click on a name opens its note. Where the [threads](/guide/story-threads) view found two scenes disagreeing on a fact, a red diamond sits in the gutter of both, the hover box and the pane say what clashes, and a click on the row opens the other scene. This toggle builds the map on every refresh, so it is off by default.

## Export

**Export** at the top of the page, or the command **Export manuscript to a note**, writes the page as one note beside the project: `My Novel (manuscript).md`, the outline as headings, the text as it is, comments left out, highlights kept. It is a snapshot for Pandoc, a reader or a printer: export again to refresh it, delete it whenever. Its front matter carries `creative-writer-manuscript: 1`, so the plugin never reads it back as a chapter, counts its words, or shows it on the page.

The page itself is derived from your notes every time; nothing else is written anywhere.
