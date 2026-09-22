# Plot grid

*What every thread is doing in every scene.* A scene is a row, a hand-drawn thread is a column, and the cell is what the thread does in the scene, in your words, even when it is off the page. It is the spreadsheet J. K. Rowling drew for *Order of the Phoenix*, grown out of the story timeline: the cast the timeline spread across the pane folds into one column, and the width goes to the threads. Open it from the ribbon (the table icon), with **Open plot grid**, or with the **Plot grid** button on a story card.

## Reading it

- **Rows** are scenes, headings with prose under them, grouped under their chapter, whose row says how many scenes, words and members of the cast it holds, and under the folder the chapter sits in, read as an act. A heading with no prose yet is a row too, marked *outline*: the scene is planned, not written. So is a scene planned in the project's `Outline.md` before any chapter note exists ([below](#before-there-are-chapters-the-outline)). Click a chapter name to open the note, a scene to put the cursor on its heading. ★ marks a bookmarked heading. The project note itself is not a scene: its own headings are never rows.
- **Plot** is filled by the code: the events the model summarised for the scene once it has been [read](/guide/model-reading), or the logline of a scene still only planned. The word count sits under the scene's name.
- **Columns** are your threads from `Story threads.md`, one per `## heading`, in the note's order within their kind. A heading's prefix says what kind of column it is, and the header's stripe repeats it:

  ```markdown
  ## Arc: [[Anna]]
  ## Theme: What we owe the dead
  ## Subplot: The letter
  ## Salt on the wind
  ```

  An **arc** follows one character; the heading links their note, and the header carries their dot. A **theme** is an argument the book makes. A **subplot** is a line of events. A heading with no prefix is a free thread, as every thread ever written was. A prefix that is almost one of these ("Arcs:", "Sub-plot:") is read as a free thread and the state line says so.
- **Cells** are the thread's stops at the scene, the lines under the heading. The first stop's note shows, a `+1` says there is another. A stop's role is a glyph before it: ▶ plant, ◀ payoff, ▼ reversal; under an arc, ▸ want, ▹ lie, ▼ turn, ◂ truth. A click selects a cell; `o` or **Open scene** goes to the scene, at the stop's quote when it has one.
- **The cell's edge is its audit.** A stop with no quote is a plan: a claim about the scene, typed ahead of the draft or from memory of it. A stop anchored to a quote the code finds in the scene is *verified* and carries a green edge; one whose quote no longer matches is *broken* and carries an amber one, the same as the threads chart's warning for a lost anchor.
- **Present, unmoved.** Once an arc column holds a verified stop, a scene where its character is on the page and the arc has no stop says so, faintly. It is the grid's one finding of its own: the scene where someone is in the room and nothing happens to them. It stays quiet until a column has earned it, because on a first draft it would fire everywhere.
- **Gaps.** What the grid can count for itself, over the written scenes, with no model: a column with a stop in fewer than a quarter of them (once there are eight), and a character on the page for three scenes or more in a row while their arc says nothing. The state line counts them and a *Gaps* section in the side column lists each with **Show**, which selects the first cell it points at. Findings, not judgements: the number is exact, what to do about it is yours. Time and POV are never counted.
- **Cast.** One column with a dot per member of the cast in their kind's colour, absence a faint dot, so a long absence still reads down the column. Click the header (or **Plot grid: fold or expand the cast**) and it spreads into one column per name, as the timeline drew it; click a name to open its note. The *Kinds* toggles in the story map panel apply here too.

- **Groups.** A row over the columns names each block in its colour, the arcs, themes, subplots and free threads with a count and a caret: down while the group is open, right once it is folded. Click it and the group folds into one narrow column with its name written down it and a line in the group's colour running to the last scene, so a folded group is never forgotten; click again and it opens. Time, POV and the plot point carry their label there without a caret. Folds are remembered.
- **Four columns with a job.** The project note can name a thread as the grid's **POV**, **Time**, **plot point** or **main theme**, with `plot-pov`, `plot-time`, `plot-beats` and `plot-theme` in its front matter, each holding a heading as written in the threads note. A column's menu (the ⋯ on its header, or a right click) has **Use as POV / Time / Plot point / Main theme**, which writes the key for you. The plot point says which step of the framework a scene is at, *Catalyst*, *Ordeal*, *Climax*; a template with beats fills it with one stop per scene when its rows are applied, and you write the rest. POV, Time and the plot point move to the derived block after Plot: Time in monospace, POV as a dot in the character's colour and their name, with a 3 px chip in that colour on the scene's name so the eye's owner survives a sideways scroll; the main theme is pinned first among the themes and read in the eyebrow over the grid. Nothing is inferred from a heading's name; a thread called *Time* that has not been given the job is an ordinary thread.
- **Order.** Time, POV and the plot point each stand alone; the arcs, themes, subplots and free threads move as groups. Drag a header to move its block, alone or together, and a bar on the target's edge says which side it lands on; a column's menu has **Move left** and **Move right** for the same by keyboard. The order is written to the project note as `plot-order`, so it syncs with the project, with Undo. Inside a group, columns keep the threads note's order.
- **A column's menu** also sets its **kind** (the prefix rewritten in the note), **renames** it (a field in the header itself, also on a double click of the name; the side column's Column section holds a second field; a column that had a job keeps it), **hides** it (the state line counts hidden columns and offers *Show hidden*) and **deletes** it.

Scene and Plot stay put while the thread columns scroll, with a faint rule at the frozen edge; a column's menu has **Freeze up to here** to keep that column and everything left of it in place too, remembered per project and capped before the frozen part takes three fifths of the pane. The header row stays put as well. A long manuscript is drawn sixty rows at a time, the next sixty as the last one scrolls into view, so a hundred and fifty scenes open as fast as eight; the keys reach every row regardless. The search filters columns and cast. A key in the corner names the glyphs, and the kinds when the cast is spread out. The head's **⋯** menu holds the folds, the cast toggle, hide and show, *Present, unmoved*, the panel, the search, the key list, **New scene**, **New chapter**, **New act**, **Start from a template…**, **Save as template…**, **Build the manuscript…**, **Open Story threads.md**, **Open Outline.md** and **Clear the search**, each as the command it also is.

## Writing in it

Everything typed into the grid is a line in `Story threads.md`; the grid writes lines and never owns them, so the note stays yours to edit by hand.

- **Select** a cell with a click, or with the arrow keys once one is selected; Home and End go to the row's first and last column, Page Up and Page Down ten rows. The side column's **Cell** section follows: the scene, the state, the role, the anchor, the note.
- **Type** into a cell with Enter, a second click, or a double click. The field grows with the text; Enter, Tab or a click elsewhere saves, Shift+Enter makes a new line, Escape puts it back. A stop that had a role and a quote keeps them. Emptying a cell removes the stop.
- **Role and anchor** are set in the side column: the role from the four thread roles, or the eight under an arc; the anchor as a few words quoted from the scene, which the grid looks for in the prose and reports as verified or broken. **Save stop** writes the line. **Remove stop** (or Delete on the selected cell) takes it out.
- **Open scene** (or `o`) goes to the scene at the anchor when there is one. Escape from a selected cell puts the focus on the row's name.
- **Columns**: the side column lists every column by kind with its count; **New column** takes a heading, `Arc: [[Anna]]`, `Theme: …`, `Subplot: …` or a plain name, and writes it to the note as an empty section, ready to fill. Under it, **From a template…** lists every column the [templates](#templates-a-starting-shape) offer, grouped by template, minus what the grid already has, an arc placeholder spelled out once per character; picking one adds it, and a column the template gives a job to (Time, POV, the main theme) takes the job unless another column already has it. The ✕ on a column arms, and a second click deletes the heading and every stop under it.
- Every write reports in the status line with **Undo** for eight seconds: a changed cell goes back to its previous line, a written one is removed, a removed one is written back, a deleted column comes back with its stops.

## Before there are chapters: the outline

A new project has a project note and a cast and no chapter notes, so the grid has columns and no rows. The rows can be written here first. **New scene** on the empty state, in the side column's *Rows › Outline* block, in the head's menu or on any planned row starts `Outline.md` in the project folder and writes one line to it; the row appears at once and opens for its name. The note is the plan, and it is yours:

```markdown
---
creative-writer: false
creative-writer-outline: 1
---
# Act I
## The perfect record
### 1 Gainesville courtroom
<!-- Kevin wins a case he knows he should lose -->
### 4 The recess bathroom
```

`#` is an act, `##` a chapter, `###` a scene. The grid draws each scene as an outline row under its chapter and act, the chapter rows saying *outline · no note yet* and the act rows *outline · no folder yet*, since none of it is a file yet. Edit the note by hand and the grid follows; the model is never involved.

- **A planned row's menu** (the ⋯ on its name, or a right click) has **New scene below**, **New chapter below**, **New act**, **Rename…**, **Logline…**, **Move up**, **Move down** and **Delete scene**. A chapter's and an act's header row have the same for themselves. Every write reports in the status line with **Undo** for eight seconds, which puts the note back whole.
- **Rename** is a field in the row; Enter saves, Escape puts it back. A renamed scene keeps its stops: every line in `Story threads.md` that pointed at it is pointed at the new name.
- **The logline** is a line about the scene, kept as a comment under its heading and shown in the Plot column, where the model's events would go once there is prose. Click the cell to write it. The comment is the HTML one, `<!-- … -->`, not Obsidian's `%% … %%`, so the note reads clean in any other writing software; both forms are read, and neither is ever counted as prose.
- **Cells** work as everywhere: a stop typed at a planned scene links `[[Outline#Scene]]`, a plan with no anchor, since there is no page to quote yet.

**Build the manuscript…** (the block's button, the head's menu, or the command) turns the plan into files. A sheet in the side column shows exactly what will be written, as a small tree: one folder per act, one note per chapter with `story-order` in its front matter, and under each note its scene headings as `##` lines with nothing under them but the logline's comment. **One note per chapter** is the default; **One note for the whole story** writes `Draft.md` with the scenes as headings and folds the chapters and acts away. Then **Build**:

- Nothing that already exists is touched, except a chapter note that gains a heading it lacked, appended at its end. A note that has every heading already is left alone, so building again is always safe.
- Every stop in `Story threads.md` is relinked from `Outline#Scene` to `Note#Scene`, so the cells come with the scenes.
- `Outline.md` is kept, marked with the day it was built, and read no more: the rows come from the chapter notes now. The block says *Built on …*, and **Build again…** writes any scene the outline has gained since.
- The status line says what was written, *Built 4 notes in 2 folders, 10 scenes, 23 stops relinked*, with **Undo**. Undo removes only the notes the build created and that are still exactly as it wrote them, takes an act folder away only when it is left empty, and puts the threads note and the outline back as they were. A note you have started writing in stays.

## Templates: a starting shape

A template is a markdown note, not code, written in the grammar the grid already reads: under `# Columns`, one `##` heading per column, as `Story threads.md` has them; everything else is the outline's grammar, `#` act, `##` chapter, `###` scene, a comment as the scene's purpose and a `beat:` comment as its tag; the front matter names the columns that get a job. A note with no `#` heading at all is columns only, the shape of a threads note.

```markdown
---
creative-writer-template: 1
plot-time: Time
plot-pov: POV
plot-theme: Theme: Major theme
---
## Chapter number
## Time
## POV
## Main plot
## Theme: Major theme
## Subplot: Subplot 1
## Subplot: Subplot 2
## Arc: Character A
## Arc: Character B
```

That one ships in the plugin as **Story analysis**, for reading a book or a script scene by scene. So do **Three acts**, **Save the Cat** (fifteen beats in three acts, with a main theme and the B story as columns), **Hero's journey** (twelve stages) and **An arc per character**, whose one heading, `Arc: every character`, becomes an arc for each character in the cast when applied. Built-ins are hard-coded and never fetched. Your own are any note carrying `creative-writer-template` in the folder Settings → Stories and goals names, `Creative Writer/Templates` by default.

- **Start from a template…** (the empty grid, the ⋯ menu, or the command) opens a sheet in the side column: the built-ins, then yours; **Rows** and **Columns** to apply, each greyed where the template has none; one line per column with a tick, a name field for a theme or subplot so "Subplot 1" is named before it is written, and a dropdown for an arc placeholder such as "Character A" listing the cast; then the preview of what gets written and **Apply**. Apply writes the headings to `Story threads.md`, appends the structure to `Outline.md`, sets `plot-time`, `plot-pov` and `plot-theme` on the project note where the template names them, and offers Undo. Headings only, never a word of prose; what already exists is left alone. Columns keep the template's order inside each kind, since the grid groups columns by kind.
- **Save as template…** writes the grid as it stands, the columns with their jobs and the outline with its loglines and beats, to a new note in the templates folder, never over an existing one. Stops, readings and prose are not copied.
- **Beats** are a template's shape kept apart from your line: `<!-- beat: Catalyst -->` under a scene survives your own logline and a rename, and the build carries it into the chapter note.

## Before the draft and after it

The grid is used twice, and the two uses are one cell in two states. Before a scene has prose, a cell is a **plan**: a stop with no anchor, typed from the outline; a heading with no prose is a row all the same. Once the scene is written, the same cell can be checked against the page: a plan becomes **verified** when it carries a quote the grid finds in the prose, **broken** when the quote no longer matches.

- **Audit view** (`v`, the side column's *Rows* section, or the command) draws every cell by its state, ◇ plan · ◆ verified · ◈ broken, every header by its counts, and the state line as *40 cells · 12 filled · 8 verified · 3 broken*. It is a lens, not a screen: same rows, same columns, same scroll. It is not remembered.
- **Anchoring** (`"`, or **Pick…** beside the anchor field) lists the scene's sentences in the side column; on a broken stop, the sentences nearest the lost quote come first, marked with how much they share. Enter, or a click, writes the sentence as the stop's anchor. `n` and `p` walk the broken anchors, so repair is three keys: `n`, `"`, Enter.
- **Export the grid to a note** (⋯ menu) writes the same table as `Plot grid.md`, refreshed on every export, for a print or a spreadsheet; **Snapshot the grid** writes the grid as a dated markdown table beside the project, `Plot grid · 2026-09-13.md`, one row per scene, one column per thread, each cell its stop with the role and a ✓ where verified. The status line names the file with **Open**. It is never read back as a chapter (its front matter says so), so keep it, diff it, or delete it.

- **Tabs.** Once a project has a snapshot, a row of tabs sits over the table: **Now**, then one tab per snapshot, newest first, named by its day, *13 Sept*. Rename the note with a label after the date, `Plot grid · 2026-09-13 · before the rewrite.md`, and the tab reads *13 Sept · before the rewrite*. A snapshot tab draws the table the way the grid draws itself, chapter bands, scenes with their counts, the cells as text with the verified and broken marks, read only; the state line offers **Open note**. Two snapshots a tab apart are the outline against the draft.

## Reading with the model

The model reads; you write. A pass over a column shows the model each scene that has prose and no stop in that column, with the column's kind, its name, and the notes you have already written there as examples of your voice, and asks one question: what is this thread doing in this scene? What comes back is a **reading**: a note of at most twenty words and the verbatim quote that made the model think so. A reading whose quote is not on the page is dropped before it is saved. A reading is never a stop, and never a line in a chapter: it lives in `Story map.md`, and it is answered by you.

- **Read this column with the model…** is in a column's menu; **Read…** in the head (the sparkle) reads every thread column. The state line counts scenes as they go, **Stop** ends the pass with everything that landed kept; a scene unchanged since it was last read for that column is skipped, and so is one whose reading you dismissed.
- **A reading waits in the empty cell** as a sparkle on a dashed edge, never as text. Select the cell and the side column shows it whole: the note, the quote, the model. When you edit that cell, the reading is the field's placeholder, faint and uncopyable; you type over it in your own words. Writing the cell answers the reading. **Dismiss** (or `x`) is the other answer, remembered until the scene changes. `n` and `p` walk the readings awaiting you along with the broken anchors; the state line says how many there are.
- **Check this column against the draft…** is the pass for after the draft: each plan in the column (a stop with no anchor) is shown to the model with the scene as written, and the answer is a quote when the plan is on the page or *not on the page* when it is not. A found plan's side column offers **Anchor to it**, which writes the quote as the stop's anchor; a missing one stands as a debt until you either write the scene or take the plan out.
- The model is whichever **Model** the settings name: Local (Ollama) reads for nothing; Claude counts against the same daily cap as the style assistant and shows its spend there. With the model off, the head says so.
- **Propose columns…** (⋯ menu, the side column, or the empty grid) asks the model one question over the outline the map already holds, the events read per scene, the loglines of the scenes still only planned, and the cast, rather than every page: which threads run through more than one scene and deserve a column. On the paper grid, before any prose, the loglines are all it has: write a line in the Plot column of a few rows first, or the state line says there is nothing to propose from. The proposals land in the side column with a tick each, a sentence, and the scenes that carry them; one that already exists is greyed; **Add** writes the ticked ones as empty headings, with Undo. With no scene read for its events yet, the grid offers **Read the project** first.
- The prompt asks in the column's kind: an arc is asked what the scene does to the character's want, a theme how the scene argues it, a subplot what happens to it. A small local model reads subplots well and arcs less well; read an arc with a larger one, or write it yourself.

## Keys

Click anywhere on the grid and the keys work; press `?` for the list on the grid itself. Tab is never taken: it moves the focus as it does everywhere in Obsidian, and Ctrl and Cmd stay with Obsidian's own hotkeys. Nothing is bound by default.

| Key | Does |
|---|---|
| `← → ↑ ↓` | Move between cells. `Home` `End` first and last column; `PgUp` `PgDn` ten rows. |
| `Enter` | Edit the cell in place. Editing: `Enter` saves, `Shift+Enter` a new line, `Escape` puts the line back. |
| `Escape` | On a cell: back to the row's name. |
| `Delete` | Take the stop out, with Undo. |
| `"` | Anchor: pick a sentence of the scene; on a broken stop, the near matches first. |
| `n` `p` | Next and previous reading awaiting you, or broken anchor. |
| `x` | Dismiss the reading in the cell. |
| `o` | Open the scene, at the anchor when there is one. |
| `v` | Audit view. |
| `?` | The list. |

Folding a group, hiding a column, showing the hidden ones, the search, the panel and *Present, unmoved* are commands, each named in the ⋯ menu, so a key of your own can be bound in Settings → Hotkeys.

The line the grid writes is the line you would write:

```markdown
## Subplot: The letter
- [[Chapter 3#The station]] — plant: "she pocketed the letter without reading it" Anna pockets it
```

## Same data as the map and the threads

The grid is a projection of the same graph the [story map](/guide/story-map) builds and the same threads the [story threads](/guide/story-threads) view draws: same notes, same mentions, same `Story map.md` readings, same `Story threads.md` lines. Nothing is stored for the grid itself, so two machines with the same notes draw the same grid.
