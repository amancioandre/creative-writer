# Manuscript

*The whole story on one page.* Every prose note of the project in reading order, stitched into one read-only page with the folder tree as its outline. Open it from the ribbon (the book icon) or with **Open manuscript**; it opens beside the current tab so the editor stays in view.

## Reading it

- **The outline** comes from your folders. `Part One/03 Chapter Three.md` reads as *Part One* › *Chapter Three*, with the sort prefix stripped. Folder headings are muted, so the outline reads apart from the text.
- **Each note** gets its name as a heading, then its text as reading view would show it. A note whose first heading already is its name shows that heading once. The headings inside a note nest under the outline: a `# Camp` scene in a chapter in a part reads as level three.
- **Order** is manuscript order, the same the [story map](/guide/story-map), [timeline](/guide/story-timeline) and [threads](/guide/story-threads) use: notes by path, unless `story-order: 3` in a note's front matter says otherwise.
- **Click any passage** and the note opens in the editor with the cursor at that sentence. Click a heading to open the note at its top. Links in the text work as they do anywhere.
- **Prose only**, at the top of the page, hides lists, tables, code and callouts and keeps paragraphs, headings, quotes and scene breaks (`***`).

The page follows your typing: edit a chapter in the editor beside it and that chapter redraws after a moment, the rest of the page untouched, the scroll position kept. A page in a hidden tab waits and redraws when it is shown.

## What is on the page

Only the story. These stay out:

- **Typed notes**: characters, places, items, factions, events, whether typed by `type:` in front matter or by a `Characters/`, `Places/`… folder.
- **The plugin's notes**: `Story map.md`, `Story threads.md`, the writing log.
- **Notes with `manuscript: false`** in their front matter: research, an outline, the project note when it is not the manuscript itself.
- **Notes with no prose**: a list of beats, an empty placeholder chapter.

`manuscript: true` puts a note on the page regardless of its type. The [scope rule](/guide/where-it-runs) applies first: a note the plugin does not count is not read at all.

## Comments and tags

Obsidian's `%% comments %%` are the right place for notes to self: they live in the text, sync with it, and never count as words. Reading view hides them; the manuscript page can show them.

- **Marked paragraphs** carry a dot at their edge per comment, in the tag's colour; ==highlights== show as they do in reading view. Hover the paragraph and its comments appear in a box.
- **The pane** beside the page (the **Comments** toggle at the top) has two parts. *This paragraph* shows the comments of the paragraph you last clicked and a box to write a new one: pick a tag or none, write, **Add comment** (or Ctrl+Enter), and ` %% TAG: your note %%` lands at the end of that paragraph in the note, through the open editor if there is one. *All comments* lists every comment and highlight of the manuscript in reading order, with the note each is in; the dropdown filters by tag. Click any row and the editor opens on that comment.
- A comment on a line of its own (`%%` … `%%` as a block) belongs to the paragraph before it.
- **Tags** colour a comment by the word it opens with: `%% CHECK: was it a coat in chapter three? %%`. An uppercase word and a colon, nothing else. The defaults are `TODO` (something still to write), `FIX` (prose known to be wrong), `CHECK` (continuity, facts, names), `IDEA` (a possibility) and `CUT` (kept only until you are sure); add your own under Settings → Manuscript → Tags. Deleting the comment is how a tag is resolved: there is no other state.
- **In the editor**, the tag word is tinted in the same colour, so a `TODO` stands out in the dimmed comment. Only inside `%%`: a TODO in dialogue is left alone.
- **Insert comment here** (a command; give it a hotkey) drops `%%  %%` at the cursor with the cursor inside. With a selection, the selection becomes a highlight and the comment follows it.

## Settings

Settings → Manuscript: how many folder levels become headings, whether note names do, what to strip from names (a regular expression; the default removes a leading number and its separator), whether the notes' own headings nest under the outline, prose only, comments on or off, tag tinting in the editor, and the tag list. See [Settings](/reference/settings#manuscript).

## Export

**Export** at the top of the page, or the command **Export manuscript to a note**, writes the page as one note beside the project: `My Novel (manuscript).md`, the outline as headings, the text as it is, comments left out, highlights kept. It is a snapshot for Pandoc, a reader or a printer: export again to refresh it, delete it whenever. Its front matter carries `creative-writer-manuscript: 1`, so the plugin never reads it back as a chapter, counts its words, or shows it on the page.

The page itself is derived from your notes every time; nothing else is written anywhere.
