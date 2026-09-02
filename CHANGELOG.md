# Changelog

Release notes for every version are on the [releases page](https://github.com/amancioandre/creative-writer/releases). This file carries the same text for the versions since it was started.

## Unreleased

- Selecting a paragraph on the manuscript page opens the note beside the page when no editor shows it (the editor beside the page swaps its file, or a split opens), still without taking focus. 0.7.0 only followed in an editor that was already open.
- A click or Enter on a comment row takes the page to that paragraph, the editor following, focus staying in the list; a double click or Shift+Enter goes into the editor at the comment. The same for a contradiction row and the other scene.
- A candidate in a cast line (a name the map found without a note) opens a menu on click: make it a character, place, item, faction or event note, or say it is not a name.

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
