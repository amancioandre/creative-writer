# Story threads

The manuscript as one line, and everything that ties one part of it to another as an arc over that line. Open it from the ribbon (the curve icon), with **Open story threads**, or from the story map's **Threads** button.

It exists to catch the breaks a reader feels before they can name them: a fact stated in chapter three that chapter forty contradicts, a clue planted and never paid off, a character who is on every page and then gone for a hundred. Paragraph-level style has its own tools; this view is about the story.

::: tip Inspired by an argument
The layout is borrowed from *BibViz*, a chart of the Bible's internal contradictions: every chapter on one axis, an arc between every pair that disagree. Turned on a novel, the same picture shows where the plot holds and where it does not — and a wall of red arcs is a verdict you can see from across the room.
:::

## The axis

Every **scene** (a heading and its prose) is a slot along the bottom, as wide as its share of the words — the axis *is* the length histogram. A bar hangs under each slot, taller for longer scenes; slots alternate shade at every note boundary so chapters read as bands; bookmarked scenes get a yellow edge. Hover a bar for the note, heading and word count; click it for its card; double-click to jump to it in the editor.

Scenes run in **manuscript order**: notes by path, unless a note says where it belongs with `story-order: 3` in its front matter. Ordered notes come first, by number; the rest follow in path order. The story map and timeline use the same order, so the three views always agree.

## Threads

A thread is a named thing that recurs, and the scenes it touches. Between each consecutive pair of scenes the view draws an arc; the arc's height grows with the distance, so a set-up paid off at the far end of the book rises to the top of the band while neighbouring scenes barely lift off.

| Kind | Colour | Where it comes from | On by default |
|---|---|---|---|
| **Names** (entity) | the node's colour from the story map | Where a character, place, item or faction is mentioned — the story graph, no model. | off — these are the densest and the least surprising; *Follow one name…* in the panel turns on just that one |
| **Facts** | accent | Concrete facts a local model read from each scene: eye colour, age, hometown, weapon, who is alive, who knows what. One thread per name-and-attribute that appears in two scenes or more. | on |
| **Yours** (writer) | orange | Threads you drew by hand in `Story threads.md` — a clue, a motif, a promise to the reader. | on |

Hover an arc and the rest of its thread lights up with it; click for the card. Arcs from a fact reading whose scene has since changed are **dashed** — read again to refresh.

## Contradictions

Two scenes state a different value for the same fact — *green* here, *grey* there — and a **red** arc joins them, painted on top of everything. The count sits in a badge top-left; click it to show only contradictions. The card shows both scenes, both values and both quotes, and jumps to either.

Contradictions are found by code, never by the model. Values are compared after a small, literal normalisation — case, plurals, articles, *colour/color*, number words to digits, and words the attribute already says ("green eyes" under *eye colour* is "green") — and a value that merely restates the other ("tall", "very tall") is agreement. Different attributes are never merged: *eyes* and *eye colour* stay two threads, because merging by a shared word would set "hair: long" against "hair colour: brown". A model that names its attributes consistently gives one thread per fact; one that varies them gives a missed match, never a false alarm.

**Dismiss** on the card is for the rest: a change the story means (she dyed her hair), or two ways of saying one thing the normaliser did not catch. A dismissed pair fades and drops out of the count; *Show dismissed* in the panel brings them back, and **Restore** undoes it. Dismissals are remembered in `Story map.md` by a key built from the two scenes and the two values, so they survive re-reads and reorderings and only come back if you change one of the quoted scenes so the value or the heading changes — at which point the question is legitimately new.

## Reading for facts

**Read project for facts** in the panel (or **Read this note for facts** on a scene's card, or the command of that name) sends each scene to the local model with the names known to be in it and a continuity editor's brief: the concrete, checkable facts the scene states, with a verbatim quote for each. What comes back is kept only where it can be checked — the subject must be a name in the scene, the quote must really be there. Like the relationship reading, it is local only (Ollama), skips scenes unchanged since their last reading, and saves after every scene so stopping loses nothing. See [Reading a project](/guide/model-reading).

## Drawing threads yourself

Click a scene's bar, and its card ends with **Add to a thread**: pick an existing thread or name a new one, add a note if you like, and the scene becomes a stop on it. What gets written is a line in `Story threads.md` in the project folder:

```markdown
## The letter
- [[Chapter 3#The station]] — Anna pockets it
- [[Chapter 12#Dinner]] — first mentioned aloud
- [[Chapter 41#The reading]] — payoff
```

Write it by hand if you prefer — one `## heading` per thread, one list line per scene, wikilinks or markdown links, `—`, `:` or `-` before the note. A link with no heading means the note's first scene. The view draws each thread as arcs; a link that points at no scene is listed in the panel as broken and kept on the thread's card until you fix it. **Remove** on an arc's card takes a stop out; **Threads note** in the panel opens the file. Obsidian keeps the links current when you rename a chapter.

## Strips

Under the bars, on the same axis, run small bar charts — one value per scene, toggled in the panel's *Strips* section:

| Strip | What |
|---|---|
| Cast on stage | How many names are mentioned in the scene. |
| First appearances | Names appearing for the first time here — where the story keeps introducing people. |
| Threads through | How many threads touch the scene. |
| Contradictions per 1k words | Open contradictions touching the scene, normalised by its length so a long chapter is not guilty for being long. Drawn red. |
| Open threads (yours) | Hand-drawn threads that have started and not yet reached their last stop — what the reader is carrying. |

Strips share the slots exactly, so a spike lines up with the scene above it at every zoom.

## The panel

| Section | What |
|---|---|
| *Head* | Project dropdown; a search box over thread labels. |
| *Actions* | **Read project for facts** / **Stop**; **Story map**; **Threads note**; **Fit**. |
| **Threads** | A toggle per kind with counts; *Follow one name…*; any broken links in your threads. |
| **Contradictions** | Open and dismissed counts; *Only contradictions*; *Show dismissed*. |
| **Strips** | A toggle per strip. |

**Ctrl/⌘ + wheel** zooms the axis horizontally around the pointer (the strips zoom with it); the view scrolls sideways like any wide page; **Fit** returns to one screen. The panel's state persists in the plugin settings.

## Sync

The view is a pure function of the vault: the same notes draw the same threads on any machine. Three things persist, all as Markdown in the project folder: fact readings and dismissed contradictions in `Story map.md`, and your own threads in `Story threads.md`. See [Files & sync](/reference/data-and-sync).
