# Plot grid

*What every thread is doing in every scene.* A scene is a row, a hand-drawn thread is a column, and the cell is what the thread does in the scene, in your words, even when it is off the page. It is the spreadsheet J. K. Rowling drew for *Order of the Phoenix*, grown out of the story timeline: the cast the timeline spread across the pane folds into one column, and the width goes to the threads. Open it from the ribbon (the table icon), with **Open plot grid**, or with the **Plot grid** button on a story card.

## Reading it

- **Rows** are scenes, headings with prose under them, grouped under their chapter, whose row says how many scenes, words and members of the cast it holds, and under the folder the chapter sits in, read as an act. A heading with no prose yet is a row too, marked *outline*: the scene is planned, not written. Click a chapter name to open the note, a scene to put the cursor on its heading. ★ marks a bookmarked heading. The project note itself is not a scene.
- **Words** and **Plot** are filled by the code: the scene's length, and the events the model summarised for it once the scene has been [read](/guide/model-reading).
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
- **Cast.** One column with a dot per member of the cast in their kind's colour, absence a faint dot, so a long absence still reads down the column. Click the header (or **Plot grid: fold or expand the cast**) and it spreads into one column per name, as the timeline drew it; click a name to open its note. The *Kinds* toggles in the story map panel apply here too.

- **Groups.** Over the table, one pill per kind with its count: click a pill and the group folds out of the way; the pill says *3 folded* until it is clicked again. The **Cast** pill folds and expands the cast. Folds are remembered.
- **Three columns with a job.** The project note can name a thread as the grid's **POV**, **Time** or **main theme**, with `plot-pov`, `plot-time` and `plot-theme` in its front matter, each holding a heading as written in the threads note. A column's menu (the ⋯ on its header, or a right click) has **Use as POV / Time / Main theme**, which writes the key for you. POV and Time move to the derived block after Words: Time in monospace, POV as a dot in the character's colour and their name, with a 3 px chip in that colour on the scene's name so the eye's owner survives a sideways scroll; the main theme is pinned first among the themes and read in the eyebrow over the grid. Nothing is inferred from a heading's name; a thread called *Time* that has not been given the job is an ordinary thread.
- **A column's menu** also sets its **kind** (the prefix rewritten in the note), **renames** it (the side column's Column section holds the field, and a column that had a job keeps it), **hides** it (the state line counts hidden columns and offers *Show hidden*) and **deletes** it.

The first column and the header row stay put while you scroll. The search filters columns and cast. A key in the corner names the glyphs, and the kinds when the cast is spread out. The head's **⋯** menu holds the folds, the cast toggle, hide and show, *Present, unmoved*, the panel, the search, the key list, **Open Story threads.md** and **Clear the search**, each as the command it also is.

## Writing in it

Everything typed into the grid is a line in `Story threads.md`; the grid writes lines and never owns them, so the note stays yours to edit by hand.

- **Select** a cell with a click, or with the arrow keys once one is selected; Home and End go to the row's first and last column, Page Up and Page Down ten rows. The side column's **Cell** section follows: the scene, the state, the role, the anchor, the note.
- **Type** into a cell with Enter, a second click, or a double click. The field grows with the text; Enter or a click elsewhere saves, Shift+Enter makes a new line, Escape puts it back. A stop that had a role and a quote keeps them. Emptying a cell removes the stop.
- **Role and anchor** are set in the side column: the role from the four thread roles, or the eight under an arc; the anchor as a few words quoted from the scene, which the grid looks for in the prose and reports as verified or broken. **Save stop** writes the line. **Remove stop** (or Delete on the selected cell) takes it out.
- **Open scene** (or `o`) goes to the scene at the anchor when there is one. Escape from a selected cell puts the focus on the row's name.
- **Columns**: the side column lists every column by kind with its count; **New column** takes a heading, `Arc: [[Anna]]`, `Theme: …`, `Subplot: …` or a plain name, and writes it to the note as an empty section, ready to fill. The ✕ on a column arms, and a second click deletes the heading and every stop under it.
- Every write reports in the status line with **Undo** for eight seconds: a changed cell goes back to its previous line, a written one is removed, a removed one is written back, a deleted column comes back with its stops.

## Keys

Click anywhere on the grid and the keys work; press `?` for the list on the grid itself. Tab is never taken: it moves the focus as it does everywhere in Obsidian, and Ctrl and Cmd stay with Obsidian's own hotkeys. Nothing is bound by default.

| Key | Does |
|---|---|
| `← → ↑ ↓` | Move between cells. `Home` `End` first and last column; `PgUp` `PgDn` ten rows. |
| `Enter` | Edit the cell in place. Editing: `Enter` saves, `Shift+Enter` a new line, `Escape` puts the line back. |
| `Escape` | On a cell: back to the row's name. |
| `Delete` | Take the stop out, with Undo. |
| `o` | Open the scene, at the anchor when there is one. |
| `?` | The list. |

Folding a group, hiding a column, showing the hidden ones, the search, the panel and *Present, unmoved* are commands, each named in the ⋯ menu, so a key of your own can be bound in Settings → Hotkeys.

The line the grid writes is the line you would write:

```markdown
## Subplot: The letter
- [[Chapter 3#The station]] — plant: "she pocketed the letter without reading it" Anna pockets it
```

## Same data as the map and the threads

The grid is a projection of the same graph the [story map](/guide/story-map) builds and the same threads the [story threads](/guide/story-threads) view draws: same notes, same mentions, same `Story map.md` readings, same `Story threads.md` lines. Nothing is stored for the grid itself, so two machines with the same notes draw the same grid.
