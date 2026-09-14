# Commands

All commands appear in the palette under **Creative Writer:**. None has a default hotkey; assign your own in Settings → Hotkeys.

| Command | What it does |
|---|---|
| **Toggle Zen Mode** | Hide or show ribbon, tabs, sidebars, status bar and title bar (and go fullscreen if *Fullscreen in Zen Mode* is on). |
| **Toggle Creative Writer (everywhere)** | Flip the master switch for all editor features. |
| **Toggle Creative Writer for this note** | Write `creative-writer: true` or `false` into the active note's front matter. |
| **Lens: style checks** / **Lens: words** | Switch that [lens](/guide/lenses) on, everywhere; run it again to switch it off. One lens at a time. |
| **Lens: next** / **Lens: off** | Cycle through the lenses (what the status-bar item does on a click), or show the plain page. |
| **Analyse paragraph with model** | Send the cursor paragraph to the configured model for contextual findings. |
| **Analyse selection for myth and archetype** | Sidebar report of mythic patterns and archetypes in the selection (or the whole note if nothing is selected). Local model only. |
| **Open writing desk** | Open the side panel with progress, readability, scenes and projects. |
| **Open story map** | Open the project graph in a tab. |
| **Open story timeline** | Open *Who is where* beside the current tab. |
| **Read this note with model (story map)** | Read the active note's scenes for relationships, references and events (or the whole project if no note is active). Local model only. |
| **Open story threads** | Open the [story threads](/guide/story-threads) view in a tab: the manuscript as one line, threads and contradictions as arcs over it. |
| **Open manuscript** | Open the [manuscript](/guide/manuscript) beside the current tab: the project's prose on one page, folders as its outline. Click a passage to edit it. |
| **Return to manuscript** | Bring focus back to the [manuscript](/guide/manuscript) page at the paragraph the editor cursor is in. |
| **Export manuscript to a note** | Write the active project's manuscript as one note beside it, `<Name> (manuscript).md`, comments left out. Overwritten on every export. |
| **Insert comment here** | Drop `%%  %%` at the cursor, cursor inside. A selection becomes a `==highlight==` with the comment after it. |
| **Open writer** | Open the [writer board](/guide/writer) in a tab: your tagged notes as cards in the groups of a framework, above every story. Also the dashboard ribbon icon, or open `Writer.writer` in the explorer. |
| **Writer: next lane** / **previous lane** / **next group** / **previous group** / **new note in the focused group** / **add an existing note** / **new story** / **fit the board** / **show keyboard shortcuts** | The [writer board's keys](/guide/writer#the-keyboard) and its side column as commands, live while the board is the active tab, so they can be given hotkeys of your own. |
| **Story map: add a node** / **fit the map** / **show all (leave the focus)** / **shake the layout** / **read project with model** / **reset filters** | The [story map's](/guide/story-map) head and side column as commands, live while the map is the active tab. |
| **Story threads: zoom in** / **zoom out** / **fit the manuscript** / **open Story threads.md** / **read project for facts** | The [story threads'](/guide/story-threads) head and side column as commands, live while the threads are the active tab. |
| **Plot grid: clear the search** | Live while the grid is the active tab. |
| **Plot grid: fold or expand the cast** | Live while the grid is the active tab. One column of dots, or one column per name. |
| **Plot grid: open Story threads.md** | Live while the grid is the active tab. |
| **Plot grid: toggle the panel** | Live while the grid is the active tab. Folds or opens the side column. |
| **Plot grid: new column** | Live while the grid is the active tab. Opens the side column with the cursor in the new column field. |
| **Plot grid: fold or show the arcs** / **themes** / **subplots** / **free threads** | Live while the grid is the active tab. What the eyebrow's pills do. |
| **Plot grid: hide the selected column** / **show hidden columns** | Live while the grid is the active tab. |
| **Plot grid: present, unmoved on or off** | Live while the grid is the active tab. The faint mark on an arc that has a verified stop. |
| **Plot grid: find a column** | Live while the grid is the active tab. Puts the cursor in the search. |
| **Plot grid: keyboard shortcuts** | Live while the grid is the active tab. The list `?` shows. |
| **Plot grid: audit view** | Live while the grid is the active tab. Every cell by its state. |
| **Plot grid: next broken anchor** / **previous broken anchor** | Live while the grid is the active tab. |
| **Plot grid: pick a sentence as the anchor** | Live while the grid is the active tab, with a cell selected. |
| **Plot grid: snapshot the grid** | Live while the grid is the active tab. Writes `Plot grid · <date>.md` beside the project. |
| **Plot grid: export the grid to a note** | Live while the grid is the active tab. Writes `Plot grid.md` beside the project, refreshed on every export. |
| **Plot grid: read every column with the model** / **read this column with the model** / **check this column against the draft** | Live while the grid is the active tab. The model leaves readings; you answer them. |
| **Plot grid: dismiss the reading** | Live while the grid is the active tab, with a cell that has a reading selected. |
| **Plot grid: propose columns with the model** | Live while the grid is the active tab. One call over the events the map holds; the proposals wait in the side column for a tick. |
| **Manuscript: toggle prose only** / **toggle the comments pane** / **toggle the ruler** / **toggle story marks** / **toggle echoes** | The [manuscript's](/guide/manuscript) toolbar switches as commands, live while the manuscript is the active tab. |

Every panel's head ends in a **⋯** menu that repeats these actions as rows; each row names the command it is, so what you find in the menu you can find in Settings → Hotkeys.
| **Reference a writer card** | Pick a card from the [writer board](/guide/writer) and drop `%% REF: [[Card]] %%` at the cursor: a link the manuscript page and any export hide, counted by the board as a use. |
| **Copy writer schema** | Put the [writer protocol](/reference/writer-file) on the clipboard, for your vault's framework and tag prefix: the tags, the front matter keys, the REF comment and the writer file format. Paste it to a person or a tool that is preparing or migrating your board. |
| **Read this note for facts (story threads)** | Read the active note's scenes for concrete facts — eye colours, ages, places, who knows what — so scenes can be checked against each other. Local model only. |
| **Read contradictions for intent (story threads)** | Ask the local model what each open contradiction means — a reversal the story intends, an error, or the same thing said twice. The verdict is a proposal on the card. |
| **Read project for echoes (story threads)** | Embed every sentence with the local model and keep the pairs that say the same thing in different words, as echoes in the threads view. |

## Ribbon

Five ribbon icons: the dashboard opens the writer, the fork opens the story map, the chart opens the story timeline, the curve opens the story threads, the book opens the manuscript. Obsidian lets you reorder or hide ribbon items from the ribbon's own menu.

## Status bar

Two items: the model status (the model's name while it works; session cost for Claude) and the readability label for the current paragraph, which opens the writing desk when clicked.
