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
- **Cells** are the thread's stops at the scene, the lines under the heading. The first stop's note shows, a `+1` says there is another. A stop's role is a glyph before it: ▶ plant, ◀ payoff, ▼ reversal; under an arc, ▸ want, ▹ lie, ▼ turn, ◂ truth. Click a cell to go to the scene, at the stop's quote when it has one.
- **The cell's edge is its audit.** A stop with no quote is a plan: a claim about the scene, typed ahead of the draft or from memory of it. A stop anchored to a quote the code finds in the scene is *verified* and carries a green edge; one whose quote no longer matches is *broken* and carries an amber one, the same as the threads chart's warning for a lost anchor.
- **Present, unmoved.** Once an arc column holds a verified stop, a scene where its character is on the page and the arc has no stop says so, faintly. It is the grid's one finding of its own: the scene where someone is in the room and nothing happens to them. It stays quiet until a column has earned it, because on a first draft it would fire everywhere.
- **Cast.** One column with a dot per member of the cast in their kind's colour, absence a faint dot, so a long absence still reads down the column. Click the header (or **Plot grid: fold or expand the cast**) and it spreads into one column per name, as the timeline drew it; click a name to open its note. The *Kinds* toggles in the story map panel apply here too.

The first column and the header row stay put while you scroll. The search filters columns and cast. A key in the corner names the glyphs, and the kinds when the cast is spread out. The head's **⋯** menu holds the cast toggle, **Open Story threads.md** and **Clear the search**, each as the command it also is.

## Writing in it

For now the grid reads the threads note; it does not yet write it. Add a stop with **Add to a thread** on a scene's card in the [story threads](/guide/story-threads#drawing-threads-yourself) view, or write the line by hand:

```markdown
## Subplot: The letter
- [[Chapter 3#The station]] — plant: "she pocketed the letter without reading it" Anna pockets it
```

## Same data as the map and the threads

The grid is a projection of the same graph the [story map](/guide/story-map) builds and the same threads the [story threads](/guide/story-threads) view draws: same notes, same mentions, same `Story map.md` readings, same `Story threads.md` lines. Nothing is stored for the grid itself, so two machines with the same notes draw the same grid.
