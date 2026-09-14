# Story threads

The manuscript as one line, and everything that ties one part of it to another as an arc over that line. Open it from the ribbon (the curve icon), with **Open story threads**, or from the story map's **Threads** button.

It exists to catch the breaks a reader feels before they can name them: a fact stated in chapter three that chapter forty contradicts, a clue planted and never paid off, a character who is on every page and then gone for a hundred, a phrase reached for in every chapter. Repetition inside a paragraph is the editor's business; across scenes it is the shape of a habit over the book, and that is this view's.

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
| **Echoes** | purple | A phrase or a sentence that recurs across the book, heard by the [echo finder](#echoes) offline. | off — *Follow one echo…* in the panel turns on just that one |

Hover an arc and the rest of its thread lights up with it; click for the card. Arcs from a fact reading whose scene has since changed are **dashed** — read again to refresh.

## Contradictions

Two scenes state a different value for the same fact — *green* here, *grey* there — and a **red** arc joins them, painted on top of everything. The count sits in a badge top-left; click it to show only contradictions. The card shows both scenes, both values and both quotes, and jumps to either.

Contradictions are found by code, never by the model. Values are compared after a small, literal normalisation — case, plurals, articles, *colour/color*, number words to digits, and words the attribute already says ("green eyes" under *eye colour* is "green") — and a value that merely restates the other ("tall", "very tall") is agreement. Different attributes are never merged: *eyes* and *eye colour* stay two threads, because merging by a shared word would set "hair: long" against "hair colour: brown". A model that names its attributes consistently gives one thread per fact; one that varies them gives a missed match, never a false alarm.

A contradiction is one of two things, and the card has a verb for each.

**This is a reversal** is for the change the story means: she dyed her hair after the funeral, the letter turns out to have been addressed to her mother. The pair becomes one of your own threads, written into `Story threads.md` with the earlier scene as the *plant* and the later one as the *reversal*, both anchored to the model's quotes (see [Directed threads](#directed-threads)). It leaves the red count without a dismissal: the arc is now orange, with an arrow, and it is yours.

**Dismiss** is for the rest: two ways of saying one thing the normaliser did not catch. A dismissed pair fades and drops out of the count; *Show dismissed* in the panel brings them back, and **Restore** undoes it. Dismissals are remembered in `Story map.md` by a key built from the two scenes and the two values, so they survive re-reads and reorderings and only come back if you change one of the quoted scenes so the value or the heading changes — at which point the question is legitimately new.

## Reading for intent

Whether a contradiction is a planned reversal is a judgement, and judgement is where a model earns its place. **Read contradictions for intent** in the panel (or the command of that name) shows each open contradiction to the local model — both quotes, the paragraph around each, and which comes first — and asks one question: does the later scene mean to overturn the earlier one, is it a slip, or are the two values the same thing said twice? The answer is one word from that list, a reason of a sentence, and a confidence.

The verdict goes onto the card as a line: *The model reads this as a reversal: she dyes her hair after the funeral (82%)*. It is a proposal and nothing more. **Accept as a reversal** writes the directed thread, exactly as *This is a reversal* does; *Dismiss* stays for the pair the model calls the same thing; an *error* is yours to fix. The map the model judges on is deterministic — the contradiction was found by code — and the explained flag is only ever set by code from the thread you accepted. Verdicts are kept in `Story map.md` by the contradiction's key, so they survive re-reads and reorderings, and pairs already read are skipped next time. Local model only (Ollama).

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

Write it by hand if you prefer — one `## heading` per thread, one list line per scene, wikilinks or markdown links, `—`, `:` or `-` before the note. A link with no heading means the note's first scene. The view draws each thread as arcs; a link that points at no scene is listed in the panel as broken and kept on the thread's card until you fix it. **Remove** on an arc's card takes a stop out, with an **Undo** in the status line that writes it back; **Threads note** in the panel opens the file. Obsidian keeps the links current when you rename a chapter.

## Directed threads

A thread with roles on its stops. After the separator, a line may name what the stop is and hang it on a sentence:

```markdown
## The letter
- [[Chapter 3#The station]] — plant: "she pocketed the letter without reading it"
- [[Chapter 12#Dinner]] — touch: first mentioned aloud
- [[Chapter 41#The reading]] — payoff: "the letter had been addressed to her mother"
```

| Word | Meaning |
|---|---|
| `plant:` | A promise to the reader: a clue, a setup, a belief the story will overturn. |
| `payoff:` | The scene that keeps the promise. |
| `reversal:` | The scene that deliberately overturns what the plant said. What **This is a reversal** writes. |
| `touch:` | Any other scene the thread passes through. A line with no word is a touch, so every thread you wrote before still reads the same. |

One `"quoted sentence"` on the line is the stop's **anchor**: the quote is looked up in the scene (case, emphasis marks and curly quotes aside), and the stop becomes that sentence rather than the whole heading. Nothing is written into your chapter to hold the place. A quote that no longer matches is listed in the panel as *no longer in* the scene and flagged on the card until you fix it, like a dead link.

On the chart a directed thread's arcs carry an **arrow**, and a plant with no payoff or reversal after it draws a short **stub** that ends in the air: a promise the reader is still carrying. The panel lists those, and the *Open threads (yours)* strip counts a plant as open until its payoff. An arc's card shows each stop's role and quote, and **Promise** / **Pays off** set the roles from there.

On the [manuscript](/guide/manuscript) page, with *Story* on, an anchored plant is an orange mark in the gutter at its sentence and an anchored payoff or reversal a green one; each names the other end, and a click takes the page there.

## Echoes

The repetition rule hears a word twice in one paragraph. What nobody hears is the phrase reached for every time a character is tired, the image used in chapter three and again in chapter eleven, the sentence rewritten in slightly different words two scenes later. The **echo finder** listens across the whole project, offline, and draws what it hears as a thread of its own kind:

- **A phrase**: a run of words that recurs in different paragraphs, reported whole — *there was salt on the wind*, not *salt on the* and *on the wind*. Names and dialogue tags never make one.
- **A sentence**: two sentences that say nearly the same thing in different words, in different paragraphs.

The unit is the pair. Click an arc and the card shows both ends with their sentences, how far apart they are, and what it makes of them: a **tic** is heard within a couple of scenes, a **habit** is spread over three or more. Distance works the other way round from a fact: a pair two scenes apart grates, a pair three hundred pages apart is invisible, so the nearest pairs rank first and a habit spread over the book never falls out of the list.

Echoes are never red and never counted with the contradictions. They start off; *Echoes* in the panel turns them on, *Follow one echo…* shows just one, and the *Echoes* strip under the axis is a summary of where they land. **Settings → Story threads → Echo sensitivity** decides how many you hear about.

A third tier needs a model. **Read project for echoes** in the panel (or the command of that name) embeds every sentence of eight words or more with the local embedding model (Settings → Model assistant → *Ollama embedding model*, `nomic-embed-text` by default) and keeps the pairs that say the same thing in unrelated words. Only the pairs are stored, in `Story map.md`, each with the hash of its scenes, so a pair goes stale when either scene changes and the panel says *read again*. The vectors are never kept. Like every model reading, it runs on command only.

**Keep as a motif** on the card is the way to say a repetition is yours on purpose. It writes a thread named after the echo into `Story threads.md`, one stop per occurrence, each anchored to the words, and the echo stops being a finding. Any phrase you quote in a thread of your own is treated the same way: a quoted echo is a motif.

## Strips

Under the bars, on the same axis, run small bar charts — one value per scene, toggled in the panel's *Strips* section:

| Strip | What |
|---|---|
| Cast on stage | How many names are mentioned in the scene. |
| First appearances | Names appearing for the first time here — where the story keeps introducing people. |
| Threads through | How many threads touch the scene. |
| Contradictions per 1k words | Open contradictions touching the scene, normalised by its length so a long chapter is not guilty for being long. Drawn red. |
| Open threads (yours) | Hand-drawn threads that have started and not yet reached their last stop — what the reader is carrying. A plant counts as open until its payoff. |
| Echoes | Where the echoes land. A summary only; the pair is the finding. |

Strips share the slots exactly, so a spike lines up with the scene above it at every zoom.

## The panel

| Section | What |
|---|---|
| *Head* | Project dropdown; a search box over thread labels. |
| *Head* | The project, a search, one line (*12 scenes · 5 arcs · 1 contradiction*), **Fit**, **Threads note**, and the jumps to the sibling panels (the story map among them). |
| *Side column* | **Read project for facts** / **Stop**, the one filled button; **Read contradictions for intent** and **Read project for echoes** beneath it. |
| **Threads** | A toggle per kind with counts; *Follow one name…*; any broken links in your threads. |
| **Contradictions** | Open and dismissed counts; *Only contradictions*; *Show dismissed*. |
| **Strips** | A toggle per strip. |

**Ctrl/⌘ + wheel** zooms the axis horizontally around the pointer (the strips zoom with it); the view scrolls sideways like any wide page; **Fit** returns to one screen. The side column is docked, never floating over the chart; its state persists in the plugin settings. When nothing is drawn, the page says which filter is hiding what and offers the click that lifts it.

## Sync

The view is a pure function of the vault: the same notes draw the same threads on any machine. Three things persist, all as Markdown in the project folder: fact readings and dismissed contradictions in `Story map.md`, and your own threads in `Story threads.md`. See [Files & sync](/reference/data-and-sync).
