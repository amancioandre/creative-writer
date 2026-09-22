# Commands

All commands appear in the palette under **Creative Writer:**. None has a default hotkey; assign your own in Settings → Hotkeys. Every panel's head ends in a **⋯** menu that repeats its actions as rows, and each row names the command it is, so what you find in a menu you can find in Settings → Hotkeys.

## The editor

| Command | What it does |
|---|---|
| **Toggle Zen Mode** | Hide or show ribbon, tabs, sidebars, status bar and title bar (and go fullscreen if *Zen Mode goes fullscreen* is on). |
| **Toggle everywhere** | Flip the master switch, *Enabled*, for all editor features. |
| **Toggle for this note** | Write `creative-writer: true` or `false` into the active note's front matter. |
| **Show release note** | The one-time note about the running version: what changed, the release page, and the feedback form. Shown by itself once after install and once after a minor or major update; this brings it back. |
| **Lens: style checks** / **Lens: dialogue** / **Lens: words** / **Lens: accents** | Switch that [lens](/guide/lenses) on, everywhere; run it again to switch it off. One lens at a time. |
| **Lens: next** / **Lens: off** | Cycle through the lenses, or show the plain page. The status-bar item opens a menu of the same rows. |
| **Dialogue: tag the speaker** | Open the [speaker box](/guide/lenses#the-speaker-box) on the cursor's sentence, armed for the keyboard: arrows choose, Enter pins the speaker as a hidden `%% Name %%` comment, Escape closes. Needs the dialogue or accents lens. |
| **Words: add the word under the cursor to the list…** | The selection or the word at the cursor into the [words lens](/guide/lenses#words)'s list note, under a category picked from its headings or typed anew; the note is created when missing. |
| **Accents: the word under the cursor is the speaker's** / **Accents: the speaker never says the word under the cursor** | The selection or the word at the cursor into the character note of the line's certain speaker: `accent:` or `accent-never:`. Needs the dialogue or accents lens and a pinned or tagged line. |
| **Analyse paragraph with model** | Send the cursor paragraph to the configured model for contextual findings. |
| **Analyse selection for myth and archetype** | Sidebar report of mythic patterns and archetypes in the selection (or the whole note if nothing is selected). Local model only. |
| **Insert comment here** | Drop `%%  %%` at the cursor, cursor inside. A selection becomes a `==highlight==` with the comment after it. |
| **Reference a writer card** | Pick a card from the [writer board](/guide/writer) and drop `%% REF: [[Card]] %%` at the cursor: a link the manuscript page and any export hide, counted by the board as a use. |
| **Return to manuscript** | Bring focus back to the [manuscript](/guide/manuscript) page at the paragraph the editor cursor is in. |

## The panels

| Command | What it does |
|---|---|
| **Open writing desk** | Open the side panel with progress, readability, scenes and projects. |
| **Open writer** | Open the [writer board](/guide/writer) in a tab: your tagged notes as cards in the groups of a framework, above every story. Also the dashboard ribbon icon, or open `Writer.writer` in the explorer. |
| **Open story map** | Open the project graph in a tab. |
| **Open plot grid** | Open the [plot grid](/guide/plot-grid) beside the current tab: scenes down the side, threads across the top. It keeps the story timeline's command id, so a hotkey bound to *Open story timeline* still works. |
| **Open story threads** | Open the [story threads](/guide/story-threads) view in a tab: the manuscript as one line, threads and contradictions as arcs over it. |
| **Open manuscript** | Open the [manuscript](/guide/manuscript) beside the current tab: the project's prose on one page, folders as its outline. Click a passage to edit it. |
| **Export manuscript to a note** | Write the active project's manuscript as one note beside it, `<Name> (manuscript).md`, comments left out. Overwritten on every export. |
| **Copy writer schema** | Put the [writer protocol](/reference/writer-file) on the clipboard, for your vault's framework and tag prefix: the tags, the front matter keys, the REF comment and the writer file format. Paste it to a person or a tool that is preparing or migrating your board. |

## Readings

| Command | What it does |
|---|---|
| **Read this note with model (story map)** | Read the active note's scenes for relationships, references and events (or the whole project if no note is active). Local model only. |
| **Read this note for facts (story threads)** | Read the active note's scenes for concrete facts — eye colours, ages, places, who knows what — so scenes can be checked against each other. Local model only. |
| **Read contradictions for intent (story threads)** | Ask the local model what each open contradiction means — a reversal the story intends, an error, or the same thing said twice. The verdict is a proposal on the card. |
| **Read project for echoes (story threads)** | Embed every sentence with the local model and keep the pairs that say the same thing in different words, as echoes in the threads view. |

The plot grid's readings are below, under its own commands; they are the one place Claude reads as well as Ollama.

## While a panel is the active tab

These commands are live only while their panel is the active tab, so they can be given hotkeys of your own without clashing with the editor's.

| Command | What it does |
|---|---|
| **Writer: next lane** / **previous lane** / **next group** / **previous group** / **new note in the focused group** / **add an existing note** / **new story** / **fit the board** / **show keyboard shortcuts** | The [writer board's keys](/guide/writer#the-keyboard) and its side column as commands. |
| **Story map: add a node** / **fit the map** / **show all (leave the focus)** / **shake the layout** / **read project with model** / **reset filters** | The [story map's](/guide/story-map) head and side column as commands. |
| **Story threads: zoom in** / **zoom out** / **fit the manuscript** / **open Story threads.md** / **read project for facts** | The [story threads'](/guide/story-threads) head and side column as commands. |
| **Manuscript: toggle prose only** / **toggle the comments pane** / **toggle the ruler** / **toggle story marks** / **toggle echoes** / **toggle voices** | The [manuscript's](/guide/manuscript) toolbar switches as commands. |
| **Plot grid: clear the search** / **find a column** | The search over the columns and the cast. |
| **Plot grid: fold or expand the cast** | One column of dots, or one column per name. |
| **Plot grid: fold or show the arcs** / **themes** / **subplots** / **free threads** | What the eyebrow's pills do. |
| **Plot grid: hide the selected column** / **show hidden columns** | A column out of the way, and back. |
| **Plot grid: new column** | Opens the side column with the cursor in the new column field. |
| **Plot grid: open Story threads.md** | The note the grid writes. |
| **Plot grid: toggle the panel** | Folds or opens the side column. |
| **Plot grid: present, unmoved on or off** | The faint mark on an arc that has a verified stop. |
| **Plot grid: keyboard shortcuts** | The list `?` shows. |
| **Plot grid: audit view** | Every cell by its state: ◇ plan · ◆ verified · ◈ broken. |
| **Plot grid: next broken anchor** / **previous broken anchor** | Walk the broken anchors and the readings awaiting you. |
| **Plot grid: pick a sentence as the anchor** | With a cell selected: the scene's sentences, the near matches of a lost quote first. |
| **Plot grid: snapshot the grid** | Writes `Plot grid · <date>.md` beside the project, never read back. |
| **Plot grid: export the grid to a note** | Writes `Plot grid.md` beside the project, refreshed on every export. |
| **Plot grid: read every column with the model** / **read this column with the model** / **check this column against the draft** | The model leaves [readings](/guide/plot-grid#reading-with-the-model); you answer them. Ollama or Claude. |
| **Plot grid: dismiss the reading** | With a cell that has a reading selected. |
| **Plot grid: propose columns with the model** | One call over the events the map holds; the proposals wait in the side column for a tick. |
| **Plot grid: new scene in the outline** / **new chapter in the outline** / **new act in the outline** | A row written to `Outline.md` before the chapters exist; the new scene opens for its name. See [the outline](/guide/plot-grid#before-there-are-chapters-the-outline). |
| **Plot grid: build the manuscript from the outline** | The sheet that turns `Outline.md` into folders, chapter notes and scene headings, with Undo. |
| **Plot grid: open Outline.md** | The plan, as a note. |
| **Plot grid: start from a template** / **save as template** | The [template](/guide/plot-grid#templates-a-starting-shape) sheets in the side column: a starting shape applied as headings, or the grid as it stands written to a template note. |

## Ribbon

Five ribbon icons: the dashboard opens the writer, the fork opens the story map, the table opens the plot grid, the curve opens the story threads, the book opens the manuscript. Obsidian lets you reorder or hide ribbon items from the ribbon's own menu.

## Status bar

Three items: the [lens](/guide/lenses) that is on (*Lens: words*, *No lens*), which opens the lens menu when clicked; the model status (the model's name while it works; session cost for Claude); and the readability label for the current paragraph, which opens the writing desk when clicked.
