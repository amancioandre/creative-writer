# Plot grid: research and design

Status: **increments 0 to 6 built 2026-09-13, in one pass after the plan was agreed; 7 follows.** Departure in 6: the proposals are a section of the docked side column, not a modal, because the plugin has no floating surfaces and the shell rule says nothing covers what it filters. Departures so far: the manuscript's comments pane does not yet show readings as rows (the grid and its side column do; the pane is a follow-up); a check's verdict is stored as a reading of kind `check` on the plan's own cell rather than a separate list; POV and Time columns are excluded from *Read every column*; a column's readings are counted in the side column's list. Originally: **researched and designed 2026-09-13.** Revised the same day after review: columns have kinds (arc, theme, subplot), the model's output is a note the writer answers rather than a cell it fills, the grid has a key table, and the after-the-draft use is an audit by anchors. The prototype canvases are linked under [Prototype](#9-prototype) and predate the revision. Eight increments; each ends in a working, tested, installable plugin. The grid grows out of the story timeline rather than beside it (decision 1), and its columns are the hand-drawn threads of `Story threads.md` rather than a new store (decision 2), so the first two increments change no file format at all.

## 1. Why

A plot grid is the spreadsheet J. K. Rowling drew for *Order of the Phoenix*: one row per chapter, four fixed columns (number, time, title, plot) and then one column per subplot (the prophecy, Cho and Ginny, Dumbledore's Army, the Order, Snape and Harry, Hagrid and Grawp). Each cell says what that thread is *doing* in that chapter, in words, including what is happening off the page. Read across, a row is a chapter's whole load; read down, a column is a subplot's shape, and a run of empty cells is a thread the reader has been made to forget.

Two panels already draw the axes. The [story timeline](../guide/story-timeline.md) is scene × cast with a dot for presence; the [story threads](../guide/story-threads.md) view is the same scenes as a line with an arc between every two stops of a thread. Neither shows *content*: the timeline says Marta is in the scene, the threads chart says the letter is touched here, and nothing says what happens to the letter. The grid is that missing cell, and it is what the writer types into first when they outline ahead of the draft and reads from when they revise behind it.

## 2. What was read

| Source | The grid | What carries over |
|---|---|---|
| Rowling's grid for *Order of the Phoenix* ([Open Culture](https://www.openculture.com/2014/07/j-k-rowling-plotted-harry-potter-with-a-hand-drawn-spreadsheet.html), [Electric Literature](https://electricliterature.com/j-k-rowlings-spreadsheet-shows-how-she-wrote-harry-potter/)) | Rows are chapters. Ten columns: *No*, *Time* (month of the school year), *Title*, *Plot*, then six subplot columns. Cells track a subplot "even if it isn't mentioned on the page". | The four fixed columns and the rule that a subplot column is filled even where the thread is off stage: the cell is a note about the story, not a quote from the scene. |
| *How to outline a book with a plot grid* and *How to revise a book using a plot grid* (the two videos, via [Video Highlight](https://videohighlight.com/v/Fd9_4efYEYQ)) | Rows are chapters or scenes. Columns: chapter and plot points, timeline, POV, the "physical layer" (main plot), the "invisible layer" (theme), major subplots, character arcs, relationships. "Empty squares indicate gaps that may need addressing during revisions." Two uses: outline first and let the draft fill it, or draft first and fill the grid from the draft to see its shape. | Both uses are one grid: a cell is typed ahead or read back. Empty cells are a finding, so the grid must show them, never collapse them. POV as a column that colours the row. |
| [The Plot Grid](https://theplotgrid.com/) (plotgrid.app) | Rows are chapters and scenes, dragged into acts. Subplot columns, hideable to follow one thread. A colour per POV character tints the row. *Scene beats*: how each scene opens, peaks and ends. "Write a couple words. Write a mountain." Free in beta, $5 a month at launch. | Hide a column. POV tint. Cells that hold a word or a paragraph, so the row grows and the table must fit its rows. Scene beats are a column like any other, not a feature. |
| [StoryLine](https://github.com/PixeroJan/obsidian-storyline) for Obsidian (its `HELP.md`) | Rows are scenes sorted act → chapter → sequence, with act and chapter bands. *Sync from scenes* fills columns from a source: Characters, Plotlines (tags), Locations, or a Codex category; "manual edits are preserved in merge mode". Cells hold text, a colour, a linked scene, and entity pills detected in the text. *Auto-Note* turns a typed cell into a corkboard note. A cell inspector edits the linked scene's front matter. Grid state lives in `System/Snapshots/`. | The idea that a column can be *sourced* from the story, and that the writer's own text survives a re-sync. Not the store: StoryLine's grid is a second copy of the story that must be merged; this plugin's rule is that nothing derived is stored, so the grid is a projection and the only written thing is the writer's own cell. Entity pills are already the cast dots. |
| [Vercel's web interface guidelines](https://github.com/vercel-labs/web-interface-guidelines) | A checklist, not a grid. | Section 5 applies it to the panel: semantic table, keyboard for every gesture, `tabular-nums`, visible focus, `aria-live` state line, undo for anything destructive, virtualised rows past fifty, reduced motion honoured. |

## 3. Ubiquitous language

| Term | Meaning |
|---|---|
| **Grid** | The project's scenes down the side, its columns across the top. A pure function of the vault plus the model's readings, like the map and the timeline. |
| **Row** | A scene: a heading with prose under it, in manuscript order (`story-order:`, then path). The same rows as the timeline and the threads axis. |
| **Chapter band** | The row over a note's scenes: its name, scene count, words. The manuscript's folder eyebrow becomes an act band when the project has sub-folders. |
| **Derived column** | A column the code fills and the writer cannot type into: *Words*, *Plot* (the model's events for the scene, from `Story map.md`), and the **Cast** group (the timeline's dots, folded into one column until expanded). |
| **Thread column** | A hand-drawn thread from `Story threads.md`: its `## heading` is the column name, its stops are the cells. Every cell the writer types is a stop line. Order of headings in the note is the order of columns. |
| **Column kind** | What a thread column tracks: an **arc** (one character's development), a **theme** (an argument the book makes), a **subplot** (a line of events), or a **free** thread (today's, no kind). Declared by a prefix on the heading: `## Arc: [[Anna]]`, `## Theme: What we owe the dead`, `## Subplot: The letter`. |
| **Arc role** | What a stop is in a character's arc: `want`, `lie`, `turn`, `truth`. Only under an `Arc:` heading; elsewhere the four thread roles apply. |
| **Main theme** | The theme column the project note's `plot-theme` names. Pinned first among the themes; the eyebrow over the grid reads it. Every other theme column is a sub-theme. |
| **Cell** | A thread's stop at a scene: the note, the role (`touch` unless said), the quoted anchor if any. An empty cell is the absence of a stop. |
| **Plan** | A stop with no anchor: a claim about the scene, typed ahead of the draft or from memory of it. **Verified**: a stop whose anchor the code finds in the prose. **Broken**: a stop whose anchor no longer matches. The three are the audit. |
| **Reading** | The model's note on one cell: what it read the thread doing in the scene, with the verbatim quote that made it think so. It lives in `Story map.md`, is shown as a note, and is never a stop. The writer answers it by writing the cell in their own words, or dismisses it. |
| **Read the column** | One model pass down one column: every scene without a stop is read with the column's name, its kind, and the stops already written, and a reading comes back or nothing does. The column stays empty until the writer fills it. |
| **Column reading** | The model's suggestion that a thread exists: a name, a kind, a sentence, and the scenes that carry it. Adding it writes an empty `## Kind: name` heading. |
| **POV column** | The thread the project note's `plot-pov` names. Its stops name a member of the cast; drawn in the derived block as a dot and the name, with a chip on the scene column. Rows are not tinted. |
| **Time column** | The thread the project note's `plot-time` names. Drawn in the derived block, narrow and monospace. Any other thread called *Time* is an ordinary thread. |

## 4. The data

Nothing new is stored for the grid itself.

**Columns and cells are the threads note.** A thread column is a `## heading` in `Story threads.md`; a cell is one of its list lines. Typing "Anna pockets it" into the cell at *Chapter 3 › The station* under *The letter* writes what *Add to a thread* writes today:

```markdown
## The letter
- [[Chapter 3#The station]] — Anna pockets it
```

Changing the cell's role to *plant* and anchoring it to a sentence writes `plant: "she pocketed the letter without reading it" Anna pockets it`. Clearing the cell removes the line; the last cell removed leaves an empty heading, which stays until the column is deleted. The note keeps every guarantee it has: readable as an outline, editable by hand, synced everywhere, links kept current on rename. The grid, like the threads view, writes lines and never owns them. A thread with two stops at one scene shows the first in the cell and a "+1" that opens the note at the second.

**Arcs, themes and subplots are kinds of column,** declared on the heading so the note stays readable and hand-editable:

```markdown
## Arc: [[Anna]]
- [[Chapter 3#The station]] — want: "she pocketed the letter without reading it" to be nobody's daughter
- [[Chapter 12#Dinner]] — lie: tells Marta the letter was nothing
- [[Chapter 41#The reading]] — turn: "addressed to her mother" cannot be nobody's
- [[Chapter 42#The quay]] — truth: she reads it aloud

## Theme: What we owe the dead
- [[Chapter 3#The station]] — the letter is a debt she refuses to open
- [[Chapter 41#The reading]] — the debt is paid by reading, not by burying

## Subplot: The letter
- [[Chapter 3#The station]] — plant: Anna pockets it unread
```

An arc column is bound to the character it names when the story map knows one: its header carries the character's dot, and its cells know when the character is *on the page* (the cast dots) and the arc has no stop, which the grid draws as a faint mark, "present, unmoved". That is the one finding the grid makes that the outlining videos describe by hand: the scene where a character is in the room and nothing happens to them. It is a revision tool, not a drafting one: on a first draft most scenes move few arcs and it would fire everywhere, so it is off until the column holds at least one verified stop, and a toggle in the side column after that (decision 13). A theme column's cells say how the scene argues the theme; the main theme, named by `plot-theme:` in the project note, is pinned first and read in the eyebrow over the grid. An arc has its own four role words, `want:`, `lie:`, `turn:`, `truth:`, parsed only under an `Arc:` heading, because a want and a lie are opposites and one triangle cannot carry both (decision 12); subplots and free threads keep `plant`, `touch`, `payoff`, `reversal`. The arc heading links the character's note, `## Arc: [[Anna]]`, so Obsidian keeps it current when the note is renamed; a bare name still binds by the map's name lookup. A writer who follows a named structure names the beat in the note text. Columns are grouped in the header by kind, Arcs · Themes · Subplots · free · Cast, each group foldable like the cast. A heading with no prefix is a free thread, so every existing threads note still parses.

**The model's readings live in `Story map.md`,** beside the relation, fact and intent readings, under a new key, and nowhere else:

```json
"grid": [
  { "scene": { "path": "Chapter 3.md", "title": "The station", "line": 12 },
    "hash": "8f1c…", "column": "Subplot: The letter", "model": "qwen2.5:7b",
    "text": "Anna pockets the letter unread", "role": "plant",
    "evidence": "she pocketed the letter without reading it", "state": "open" }
]
```

Keyed by scene and column, hashed on the scene's prose, so an edit re-reads one cell. `state` is `open`, `answered` or `dismissed`: a reading is answered the moment the writer writes any stop in that cell, dismissed by a click, and either way skipped by the next pass. A hash mismatch marks it *stale* (fainter), never dropped, as fact readings are. A reading whose evidence the code cannot locate in the prose is discarded before it is saved, as every model output is. **The model never writes to a chapter file**, not prose, not a comment block: its readings are rendered as notes wherever the writer works (the grid, the manuscript's comments pane) without being in the manuscript.

**Column layout is a preference,** per project scope in `data.json`: hidden columns, widths, whether the cast group is expanded and whether chapter bands show. Two machines may want different widths; the note's heading order is the one order that syncs.

## 5. The view

The grid is the timeline grown up, in the shared panel shell.

- **Head.** Project dropdown; a search that filters columns and cast; the state line ("12 scenes · 4 threads · 7 in the cast · 3 readings awaiting you" with *Clear* when filtering); tools: *Read…* (sparkle), the side-column toggle, ⋯; the jumps.
- **Table.** Sticky corner and header row, sticky scene column, as today. Columns in order: Scene · Words · Time · POV · Plot · thread columns in note order · Cast · filler. The cast group is one column with a strip of dots until its header is clicked, when it expands to the timeline's one column per name; the state is remembered. Chapter bands stay. POV shows as a dot and name in its cell and a 3 px chip on the scene column; rows are never tinted (decision 6). A derived column can be pinned beside the scene column.
- **Cells.** Click selects; the side column's *Cell* section shows the scene, the column, the role, the quote and *Open scene*. Enter or a double-click edits in place, in a textarea that grows with the text; Escape cancels; Ctrl/Cmd+Enter saves; a click elsewhere saves. Arrow keys move the selection; Tab is never taken. An empty cell shows a faint plus on hover. Every edit reports in the status line with *Undo*, as *Remove* does on the threads chart.
- **Readings are notes, and the writer fills the cell.** A cell with an open reading is drawn empty with a dashed edge and a small note glyph; the reading's text is the textarea's *placeholder* when the cell is edited, faint and uncopyable, so the writer types over it in their own words and never accepts it verbatim. The CELL section shows the reading in full with its quote, *Open scene* at the quote, and *Dismiss*; nothing else. The same reading appears in the manuscript's comments pane under its scene as a read-only row of kind `model`, muted, so it is met where the prose is too. Writing the stop answers it; a `%% IDEA: … %%` the writer types themselves is theirs. There is no *Accept*, no *Accept all*: the column fills at the speed the writer writes. The state line counts "3 readings awaiting you"; `n` and `p` walk them.
- **Column header.** A hovered header shows a sparkle that runs *Read this column…*; its menu carries *Read this column…*, *Check this column against the draft…* (section 6), *Dismiss all readings*, *Pin column*, *Hide column*, *Use as POV* / *Use as Time* / *Use as main theme*, *Rename…* (opens the note at the heading), *Delete column…*, each row naming its command.
- **Reading a column.** *Read…* in the head asks which column (or every thread column) and shows the model and, for Claude, the estimate against the daily cap; then the state line reads "Reading scene 5 of 12 for The letter…" with *Stop*, and note glyphs appear as each scene returns. Saved after every scene, so stopping loses nothing. Local first: Ollama by default, Claude when the assistant setting says so. The prompt carries the column's kind: an arc is asked "what does this scene do to Anna's want", a theme "how does this scene argue it", a subplot "what happens to it here".
- **Proposing columns.** ⋯ › *Propose columns…* sends the project's events (already in `Story map.md`; without readings it offers *Read the project* first) and its cast, and asks for at most eight threads, each with a kind, a name, one sentence, and the scenes that carry it, arcs for the cast first. A list with checkboxes; *Add 3 columns* writes three empty headings.
- **Empty states.** No project, no scenes, no columns yet ("Name a column, or let the model propose some", with both as buttons), nobody in the cast: each names its cause and carries the fix, as the shell does.
- **Key.** The corner key names the roles (plant ▶, payoff ◀, reversal with its own mark, reading dashed, plan · verified · broken in audit view) and, when the cast is expanded, the kinds.

Applied from the Vercel guidelines: a real `<table>` with `<th scope>`; every cell a focusable control with a label ("The letter at The station"); `:focus-visible` rings, never `outline: none` without one; `font-variant-numeric: tabular-nums` on words and counts; the state line `aria-live="polite"`; "Reading…" and "Saving…" end in an ellipsis; long cells clamp to three lines until selected; rows virtualised past fifty scenes; `prefers-reduced-motion` stops the sparkle; a confirmation for *Delete column…* and an undo window for everything else; the selected cell, expanded cast and hidden columns survive a reopen.

### Keys

The rules the writer board set: click anywhere on the grid and the keys work; `?` lists them on the grid itself; Tab is never taken and moves focus as it does everywhere in Obsidian; Ctrl and Cmd stay with Obsidian's own hotkeys; nothing is registered as a default hotkey, and every ⋯ and header-menu row names its command so a key can be bound in Settings → Hotkeys. Keys are ignored while a field has focus (`inField`).

| Key | Where | Does |
|---|---|---|
| `←` `→` `↑` `↓` | grid | Move the selection a cell; `↑` `↓` skip band rows. `Home` `End` first and last column; `PageUp` `PageDown` a screen of rows. |
| `Enter` | cell | Edit in place; on an empty cell with a reading, the reading is the placeholder. |
| `Escape` | editing | Cancel, back to the cell; on a cell, back to the row header. |
| `Ctrl/Cmd+Enter` | editing | Save. A click elsewhere saves too. |
| `Shift+Enter` | editing | New line inside the cell. |
| `r` | cell | Cycle the role: touch → plant → payoff → reversal; under an arc, want → lie → turn → truth. |
| `"` | cell | Anchor: a picker of the scene's sentences; Enter attaches one as the quote. On a broken stop the picker opens filtered to near-matches of the lost quote, so repair is two keys: `n`, `"`. |
| `Delete` `Backspace` | cell | Remove the stop, with Undo in the status line. |
| `n` `p` | grid | Next and previous cell with an open reading or a broken anchor. |
| `x` | cell | Dismiss the reading. |
| `o` | cell, row | Open the scene in the editor at its heading, or at the anchor when there is one. |
| `c` | grid | Fold or expand the cast. `a` `t` `s` fold or expand the arc, theme and subplot groups. |
| `h` | column | Hide the column; `H` shows every hidden column. |
| `/` | grid | Focus the search. |
| `f` | grid | Fold the side column. |
| `v` | grid | Toggle audit view (section 6). |
| `?` | grid | The list of keys. |

`Ctrl/Cmd+Z` is Obsidian's; the grid's undo is the status line's button, also on the ⋯ menu as a command.

Fourteen letters is more than one view teaches at once, so they ship in two rounds (decision 14). Increment 3 ships the loop a writer runs all day: arrows, `Enter`, `Escape`, `Ctrl/Cmd+Enter`, `n`, `p`, `x`, `"`, `?`. The folds, `r`, `h`, `o`, `v` and `/` exist from the same increment as commands and menu rows, bindable in Settings → Hotkeys, and get their single letters once the loop has been lived with in the QA vault.

## 6. Before the draft and after it

The grid is used twice, and the two uses are one grid in two states of the same cell.

**Construction.** Before a scene has prose, a cell is a *plan*: a stop with no anchor, typed from the outline. The grid is the outline: rows are the scenes the writer means to write (a heading with no prose is still a row here, unlike the timeline, which drops it), and the cells are what each thread must do in each. Empty runs down an arc are found before a word is written. The model's part is *Propose columns* and *Read the column* over whatever prose exists; over an outline it has nothing to read and says so.

**Validation.** Once the scene is written, the same cell can be checked against the page. A plan becomes *verified* when it carries an anchor the code finds in the prose; it is *broken* when the anchor no longer matches. **Check this column against the draft…** (header menu) sends each plan with its scene to the model and asks one question: is this on the page, and where. What comes back is a quote or "not on the page", validated like every reading; the writer attaches the quote as the anchor with one key (`"` shows it first in the picker), or leaves the plan standing as a debt. The model still writes nothing: an anchor is a fact the code can check, and attaching it is the writer's act.

**Audit view** (`v`, and a toggle in the side column) draws every cell by its state, plan · verified · broken · reading, and every column header by its count, "The letter · 5 of 8 · 3 verified". The state line reads "40 cells · 12 verified · 3 broken · 2 readings awaiting you". Broken anchors are also what the threads chart already marks, so the two views agree.

**Versions.** The threads note is a markdown file in the vault, so Obsidian Sync's version history, git, or a Syncthing archive already version it; the grid adds nothing to that on purpose. What it adds is **Snapshot the grid** (⋯ menu): a dated markdown table, `Plot grid · 2026-09-13.md`, front matter `creative-writer-grid-snapshot: 1` so it is never read back, one row per scene, one column per thread, each cell its stop with the role and a ✓ where verified. The status line says where it went, "Wrote Plot grid · 2026-09-13.md", with *Open*, because a command that writes a file the grid never shows must say so or it looks like it did nothing. Two snapshots side by side are the outline against the draft; a snapshot before a revision pass and one after are the audit trail. Export in increment 6 is the same command with the date left off.

## 7. Increments

### 0 — The grid in the domain

`domain/plot/PlotGrid.ts`: `buildPlotGrid(graph, threads, mapFile, layout)` returns rows (the timeline's rows plus headings without prose), columns (derived, thread by kind, cast) and cells (plan, verified, broken, reading, or empty) as plain data, pure and tested. `Story threads.md` is already parsed by `parseStoryThreads`; the grid adds the heading-prefix kinds and the projection by scene key; anchors are matched by the existing `Anchors`. **Deliverable:** nothing visible; the tests are the spec.

### 1 — The panel, read-only

`StoryTimelineView` becomes `PlotGridView` (decision 1): same view type string so open leaves survive the update, display name *Plot grid*, icon `table`. Thread columns render their stops; *Plot* renders events; the cast folds into one column with expand; the key; the search filters columns too. The guide page moves with a note at the old address. **Deliverable:** the grid reads; everything typed into the threads note by hand shows up as cells.

### 2 — Writing in cells

`StoryThreadsNoteRepository` gains `putStop(thread, scene, text)`, `removeStop`, `addThread(name)`, `removeThread(name)` (the first exists as *Add to a thread*). Inline editing, selection, keyboard, the *Cell* section with role and quote, undo in the status line. **Deliverable:** the grid is a way to write the threads note.

### 3 — Kinds, POV, Time, keys, layout

Column groups by kind with folding; the arc column bound to its character and the "present, unmoved" mark; the main theme from `plot-theme`; POV and Time from `plot-pov` and `plot-time` in the derived block; the full key table of section 5 with `?`; hide, width, order and the groups' state per project in `data.json` with `normalizePlotGrid`; the column header menu. **Deliverable:** the grid looks like Rowling's and moves without the mouse.

### 4 — Audit view and snapshots

Plan · verified · broken from anchors; `v`; counts in headers and the state line; `n`/`p` over broken anchors; *Snapshot the grid*. No model yet. **Deliverable:** a drafted book shows which of its outline it kept.

### 5 — Read a column, check a column

`application/ports/ColumnAnalyser.ts`; `OllamaColumnAnalyser` and `ClaudeColumnAnalyser` behind `ConfiguredLlmAnalyser`'s provider choice and cost cap; `infrastructure/llm/prompts/gridRulebook.ts` (system: the column's kind and name, the stops already written as examples of the writer's voice, the rule that a thread may be advanced off the page but the evidence must be on it; user: the scene with its known names). A second question in the same rulebook for *Check against the draft*: given a plan, is it on the page, and where. `GridReading` in `StoryMapFile` with `putGridReadings`; evidence located with `locateQuote`. Readings drawn as notes, as placeholders, in the CELL section and in the manuscript's comments pane; answered by writing, dismissed singly or per column; stale on hash mismatch; `n`/`p` extended to readings. **Deliverable:** *Read this column…* on a drafted book leaves the writer a column of notes to answer, and not one word they did not write.

### 6 — Propose columns

`ColumnProposer` port over the same adapters; input is the project's events and cast, output at most eight kinded threads with evidence scenes, arcs for the cast first. The list, the checkboxes, the headings written. **Deliverable:** an empty grid is two clicks from a scaffolded one.

### 7 — Long books

Row virtualisation past fifty scenes; fit row heights; *Export grid* is *Snapshot the grid* without the date, plus optional CSV. **Deliverable:** a 120-scene manuscript scrolls without stutter.

## 8. Decisions

To confirm before increment 1.

1. **The grid replaces the timeline panel** rather than joining it as a seventh. The timeline is the grid with the cast expanded and no thread columns, so two panels would show one thing twice and the jump row would grow past what fits. Kept: the view type string, the command id (renamed *Open plot grid*), the ribbon icon slot. The canvas shows both; the separate-panel sketch is there to be rejected on sight.
2. **A column is a thread; no grid file.** The alternative, a `Plot grid.md` with a markdown table, was rejected: two files would describe the same stops, and a table cell cannot carry a role and an anchor without a second syntax. Cost: column order is heading order, and a heading rename is a rename in the note (Obsidian does not rename headings for you, but the grid's *Rename…* rewrites the one line).
3. **POV and Time are named, never inferred.** The first draft recognised them by heading name; Claude Design's review objected that renaming a column would silently change its behaviour, and that a thread a writer happens to call *Time* is still a thread. Resolved: the project note's front matter names which thread supplies each (`plot-pov: POV`, `plot-time: Time`), set from the column menu's *Use as POV* / *Use as Time*, and the two render in the derived block beside Words and Plot. The stops still live in the threads note, so there is still one store and it still syncs. Claude Design's revised artboard goes one step further and writes them "to the scene's front matter"; a scene here is a heading, not a note, so that has no home unless a per-scene properties comment under the heading is introduced (the editor already has comment tags). Open: worth deciding before increment 3, not before increment 1.
4. **The model never writes a stop, and never writes to a chapter file.** Its readings live in `Story map.md` only, are shown as notes, and are answered by the writer typing the cell in their own words; there is no *Accept*. Stricter than intent reading, where a click writes the thread: a plot grid cell is authorial text, and a reversal verdict is a fact. Reading is on command, never on idle. The alternative, writing `%% MODEL: … %%` comment blocks under the scene heading so the note is met in the editor, was rejected because it is the model writing into the manuscript file, even as a comment; the comments pane can render a reading as a row without one.
5. **Cast group folded by default.** A dot strip keeps the timeline's absence pattern readable in one column; expanding it is one click and remembered. Decided from the mock; revisit if the folded strip reads as noise in the QA vault.
6. **No row tint for POV.** Anna, Marta and Ilse are all characters and share one kind colour, so a tint per POV character would need a second palette and break the one-colour-per-kind rule the 0.9.1 audit set. POV shows as the dot and name in its cell and a 3 px chip on the sticky scene column. (Claude Design's objection; accepted.)
7. **Reversal gets its own mark.** The domain already has four roles; drawing payoff and reversal with the same triangle hides a distinction the threads note makes. Claude Design proposes a downward triangle ▼ ("plant points forward at a promise, payoff points back at one, reversal turns the promise over"), the same family and accent as the other two; adopt it unless the QA vault shows it reads as a sort arrow.
8. **Reading lives in the column header too.** A sparkle on the hovered header runs *Read this column…*; the head's *Read…* stays as the route for every column at once. Derived columns can be pinned beside the scene column for a wide grid.
9. **Column kinds by heading prefix.** `Arc:`, `Theme:`, `Subplot:` on the `## heading`, case-insensitive, English only like the role words; anything else is a free thread, so nothing existing breaks. The alternative, a kind line under the heading or a list in the note's front matter, was rejected because the heading is what the writer reads in the outline and in the threads chart's card. Claude Design's objections, that renaming a character retypes the prefix and that a typo silently re-kinds a column, are met halfway: the arc heading links the character note so Obsidian renames it, the column menu's *Set kind…* rewrites the prefix so nobody types it, and a prefix the grid does not know ("Arcs:", "Sub-plot:") is flagged in the state line rather than read as a free thread. The main theme is `plot-theme:` in the project note, like POV and Time, set from the column menu.
10. **Anchors are the audit.** A stop with a matching quote is verified, without one it is a plan, with a lost one it is broken; the threads chart already marks the third. No separate "verified" flag, so a hand-edited note cannot claim what the prose does not hold.
11. **Snapshots, not a version store.** The vault already versions the threads note; the grid writes a dated table on command and reads none of them back.
12. **Arcs have their own roles.** `want`, `lie`, `turn`, `truth`, parsed only under an `Arc:` heading; the glyphs are one family with the subplot triangles (▸ want, ▹ lie hollow, ▼ turn, ◂ truth). Claude Design's objection, accepted: "a lie is not a want, it is the opposite", and one glyph cannot honestly carry both. Cost: four more role words in the note's grammar, confined to arcs.
13. **"Present, unmoved" is off on a first draft.** It appears once a column holds a verified stop, and is a toggle after that. Accepted from the review: on a manuscript with six arcs it would fire on most cells and teach the writer to ignore it.
14. **Keys ship in two rounds.** The walk-and-dismiss loop first (arrows, Enter, Escape, Ctrl+Enter, `n`, `p`, `x`, `"`, `?`); the folds, role cycle and view toggles as bindable commands from the same increment, with their letters after the loop has been lived with. Accepted from the review: fourteen unbound letters from one panel is more than the writer board asks, and the board is the precedent.
15. **A broken anchor has a repair path.** `n` reaches it, `"` opens the sentence picker filtered to near-matches of the lost quote, Enter re-anchors. Audit view without this would be a list of red marks and no way through it.

## 9. Prototype

Two prototypes exist, made the same day.

**Claude Design, in the plugin's existing project** (the one the 0.9.1 audit came from): <https://claude.ai/design/p/eaaa30d6-c206-48a4-a3b0-1585df39b4bc?file=Plot+grid.dc.html>. Fed the research and the decisions above as a brief, it drew the filled grid, the cast expanded, the propose-columns modal and the empty state in the shared panel shell, then argued back. Its case for the fold: the grid "holds prose, so it can record the off-page", "its gaps are legible as gaps", "it is editable where it is read", and "it subsumes the timeline instead of competing with it", which is the argument for decision 1. Its five disagreements became decisions 3 and 6 to 8. A sixth artboard, *The grid, revised again*, draws the kinds, the reading-as-placeholder cell, the key list and audit view (◇ plan · ◆ verified · ◈ broken) from the revision of section 6, and its six further pushbacks became decisions 12 to 15 and the amendments to 9. A fifth artboard, *The filled grid, revised*, applies the first round: Time and POV in the derived block with "from: when / from: pov" under their names, a scene row selected so the side column becomes a scene inspector, Plot pinned beside Scene, the column header menu open over *The letter* with a command name under every row, and ▼ for reversal in the key.

**The Claude Code canvas** holds the filled grid with the side column open (*Main*), the same grid with the cast expanded (*Cast expanded*), a sheet of every cell and header state (*Cell states*), the three model frames (*Propose columns*, *Filling*, *Review*), and the separate-panel alternative as a low-fi sketch (*Option: seventh panel*). Colours, type sizes, paddings, radii and the shell's anatomy are lifted from `styles.css` and `PanelShell.ts`; the story in the cells is invented.

Canvas: <https://claude.ai/code/artifact/44a5f71a-ae1f-430a-8e7b-a8bcc1bda1de> (private to the account; export PNG or PDF from the canvas for anyone else). The artboards were checked in a headless Chrome before saving; the canvas editor's own render was not.

## 10. Verification per increment

`npm run lint`, `npm run build`, `npm test`, then the vault loop: install into `/home/apollo/obsidian-dev`, a dated QA note whose project has a threads note with an `Arc:`, a `Theme:` and a `Subplot:` column, a *POV* and a *Time* thread named from the project note, a directed thread, a plain one, a stop whose anchor no longer matches, and a chapter with no stops at all, so the empty column, the audit and the reading path are all exercised. Increment 5's QA note is run against Ollama with `qwen2.5:7b` first; the Claude path is checked once against the cap.

## 11. Execution plan

Written 2026-09-13, after the two design passes. Eight increments, each a working, tested, installable plugin; the model does not appear until the fifth, so the first five are testable with no Ollama running. One focused session per increment at the Tier 2 cadence, two for the first and the fifth.

### Order and dependencies

```
0 domain ──► 1 panel ──► 2 cells ──► 3 kinds · POV · Time · keys ──► 4 audit · snapshot
                                                                          │
                                                          5 read · check ◄┘──► 6 propose columns ──► 7 long books
```

0 to 4 are serial; each builds on the last's data. 5 needs 4's plan/verified/broken states to draw readings beside them. 6 needs 5's adapters. 7 is independent of 5 and 6 and can be pulled forward if a real manuscript stutters earlier.

### Per increment

| # | Domain and application | Infrastructure and view | Tests | QA note exercises |
|---|---|---|---|---|
| 0 | `domain/plot/PlotGrid.ts`: `Column` (derived · thread by kind · cast), `Cell` (empty · plan · verified · broken · reading), `buildPlotGrid`. `domain/threads/StoryThreadsNote.ts`: heading prefixes, `[[link]]` in an arc heading, arc roles under `Arc:`. `domain/story/Order.ts`: headings without prose as rows. | none | `tests/domain/plot/PlotGrid.test.ts` (projection by scene key, kinds, cell states from anchors), threads-note parser cases for every prefix, an unknown prefix, arc roles, a bare-name arc. Coverage stays at the thresholds. | none |
| 1 | `PanelId` gains nothing: `timeline` is renamed in display only. | `StoryTimelineView` → `PlotGridView` (same view type string, name *Plot grid*, icon `table`); `PanelShell` jump label and icon; thread columns render stops, Plot renders events, cast folds with expand; `styles.css` `.czm-pg-*`; `docs/guide/plot-grid.md` with a note at the old address. | `tests/infrastructure/obsidian/PlotGridView.test.ts` from the timeline's test: rows, bands, columns in order, fold and expand, search filters columns. | Threads note with three kinds and a free thread; the cast folded and expanded; the old timeline command still opens it. |
| 2 | `StoryThreadsNoteRepository`: `putStop`, `removeStop`, `addThread`, `removeThread`, `renameThread` (line rewrites, serialised through the existing update queue). | Selection, inline editing, the CELL section (role, anchor picker, note), the arrow loop, `Enter`, `Escape`, `Ctrl+Enter`, `Delete` with Undo in the status line; the ⋯ menu; commands in `commands.ts`. | Repository cases: add a stop to an existing thread, to a new heading, replace, remove the last stop leaves the heading, rename rewrites one line. View: type into an empty cell and read the note back; undo restores the line. | Type five cells by keyboard only; rename a column; delete one with the confirmation. |
| 3 | `PluginSettings.plotGrid` + `normalizePlotGrid`; `plot-pov`, `plot-time`, `plot-theme` in `parseProjectFrontmatter`; arc binding through `EntityIndex`. | Kind groups with fold pills; the eyebrow; POV and Time in the derived block; the 3 px chip; arc header dot; "present, unmoved" (off until a verified stop); column header menu with *Set kind…*, *Use as…*, *Pin*, *Hide*; `?` list; the first-round keys. | Settings normalisation; front matter keys; group folding state round-trips; the mark's rule. | Set POV and main theme from the menu and read the project note; fold each group; `?` matches the doc's table. |
| 4 | `domain/plot/Audit.ts`: cell state from `Anchors`; counts per column and for the grid. `domain/plot/Snapshot.ts`: the markdown table. | Audit view toggle (`v`) with the three glyphs; counts in headers and the state line; `n`/`p` over broken anchors; `"` picker filtered to near-matches; *Snapshot the grid* writing `Plot grid · <date>.md` with the front-matter flag and the status line naming it. | Audit states from a note with a matching, a missing and a moved quote; snapshot table shape; the snapshot flag keeps the file out of `VaultProjectNotes`. | Break an anchor by editing the prose, repair it with `n` `"` Enter; snapshot twice and diff. |
| 5 | `application/ports/ColumnAnalyser.ts` (read, check); `domain/story/StoryMapFile.ts` `GridReading` + `putGridReadings` (version 4 with migration); `validateReading` for grid readings through `locateQuote`. | `infrastructure/llm/prompts/gridRulebook.ts`; `OllamaColumnAnalyser`, `ClaudeColumnAnalyser` behind `ConfiguredLlmAnalyser`; *Read this column…*, *Read…* for all, *Check this column against the draft…*; readings as note glyph, placeholder, CELL section, manuscript comments pane row; answered on write, dismissed by `x`; stale on hash mismatch; `n`/`p` extended. | Adapter against recorded fixtures (no network); schema; validator drops an unlocatable quote; answered-on-write; stale on hash change; the comments pane renders a reading read-only. | `qwen2.5:7b`: read one column, answer two readings by typing, dismiss one, edit the scene and see one go stale; Claude once against the cap. |
| 6 | `application/ports/ColumnProposer.ts`; input from `StoryMapFile.readings` events and the cast. | `proposeColumnsRulebook`; the modal; headings written with kinds; *Read the project* offered when no readings exist. | Fixture-driven; headings written in the right form; the greyed duplicate. | Propose on the QA project, add two, see them empty in the grid. |
| 7 | none | Row virtualisation past fifty scenes; fit row heights; *Export grid* as the undated snapshot, optional CSV. | Virtual window renders the rows the scroll shows; export shape. | A 120-scene fixture project in the dev vault. |

### Before the first commit of increment 0

- Confirm decisions 1 to 15 in section 8, or amend them there; every later increment cites them.
- File the feature in creative-suite as one issue with the increments as a checklist, the way #3 and #4 hold echoes and directed threads.
- Copy the Claude Design files into the repo (done: `docs/public/design/plot-grid.dc.html`, `creative-writer-critique.dc.html`, `support.js`; they render only inside the Claude Design editor, which supplies React, so they are the record, not a page).

### Definition of done, every increment

`npm run lint`, `npm run build`, `npm test` green; the vault loop from section 10; the guide page and the reference tables updated in the same commit; the changelog line written; `docs/development/plot-grid.md` Status line updated with what departed from the plan and why, as the echoes doc does.

### Risks

- **The threads note grammar grows** (prefixes, four arc roles, `[[link]]` headings). Every addition is confined and parses today's notes unchanged, and the parser tests carry one fixture per generation of the note. If the grammar reaches a third round, stop and consider a kind field.
- **The timeline rename** moves a shipped command's name. The id stays, so bound hotkeys survive; the release note says so.
- **Placeholder readings on Obsidian's textarea**: the placeholder must not be selectable or copyable, which the native attribute guarantees; if the Obsidian build ever styles placeholders away, fall back to a faint line under the field, never text in it.
- **Local model quality on arcs.** A 7B model reads subplots well and arcs badly. Increment 5's QA runs the arc prompt on the QA project before the Claude path, and the rulebook keeps the arc question narrow: what this scene does to the want, in one sentence, with a quote.
