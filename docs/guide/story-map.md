# Story map

One graph of a [project](/guide/projects): the people, places and things of the story as nodes; how they are connected as edges, in three layers you can switch on and off. Open it from the ribbon (the fork icon) or with **Open story map**.

::: tip Not a `.canvas`
The map is drawn by the plugin as SVG, not as an Obsidian Canvas file. Nothing is written to your vault to draw it; the graph is rebuilt from your notes every time.
:::

The map works in both directions. **Push**: write, and the map appears from your prose. **Pull**: start from a blank map — or from a novel you are reading, not writing — and draw the cast and their ties by hand; every node you add is a note, every edge a line in one. See [Drawing the map yourself](#drawing-the-map-yourself).

## What a node is

| Kind | Comes from | Default colour |
|---|---|---|
| **Character** | A note with `type: character` in its front matter, or in a folder named `Characters/`, `People/`, `Cast/`… | blue |
| **Place** | `type: location` / `place`, or a `Places/`, `Locations/`, `World/`… folder | green |
| **Item** | `type: item`, or `Items/` — the rifle, the letter, the truck | yellow |
| **Faction** | `type: faction`, or `Factions/`, `Houses/`… | orange |
| **Event** | `type: event`, or `Events/` | red |
| **Note** | Every other note in the project: chapters, scenes. Hidden by default; turn on the *Notes* kind to see them. | grey |
| **Unnamed** (candidate) | A capitalised name that recurs three times in the prose but has no note. Dashed outline. | grey |
| **Outside** (reference) | Something a model said the story is echoing — a myth, a historical event, another book. Hollow with a purple ring. | purple |

Colours are yours to change in the panel. The full folder and front-matter conventions are in [Structuring a project](/guide/story-projects).

### Names in prose

Typed notes are found in the text by name, by any `aliases:` you give them (Obsidian's own property), and by a unique surname or given name — "Marta" resolves to *Marta Kovács* as long as she is the only Marta. "The Grey Tower" also answers to "Grey Tower". Ambiguous parts ("Kovács" with two Kovácses) do not resolve, on purpose.

Unknown names are collected too: a capital letter mid-sentence is the signal. Capitals after an opening quote, a dash, a bracket or a colon count as sentence starts, ~250 function words and dialogue openers are excluded, and every candidate goes through the part-of-speech tagger, which vetoes pronouns, modals, adverbs, numbers, gerunds and bare adjectives. A name seen mid-sentence anywhere is then recognised at sentence start too. This is why "He", "Can" and "Waiting" never become nodes while "Bear" and "Zsófi" do.

## The three layers

| Layer | Edges | Where they come from |
|---|---|---|
| **Links** (grey; **orange** for drawn) | *linked* — a wikilink one note makes to another; *appears* — an entity and the chapter it is mentioned in; *yours* — a relationship you drew on the map or wrote under `## Relationships` | `metadataCache`; the writer's own links and lines |
| **Scenes** (accent colour) | *N scenes together* — two entities mentioned in the same scene, thicker with more shared scenes; *labelled relationships* ("sister", "owes money to") | offline extraction; the model reading |
| **References** (purple) | an entity → an outside reference, labelled with the model's note ("myth: descent with a rule not to look back") | the model reading |

A **scene** is a heading and the prose under it. Every extracted edge carries the scenes that justify it; click the edge to see them and jump to any.

Edges from a model reading whose scene has changed since are drawn **dashed** (stale) rather than dropped — re-read the note to refresh them.

## The map itself

- **Pan** by dragging the background; **zoom** with the wheel (around the cursor); **Fit** in the panel frames everything.
- Nodes settle under a live force simulation and stop moving after a few seconds. **Drag** a node and its neighbours react; a dragged node stays **pinned** where you left it, and pinned positions are remembered in `Story map.md`, so the map opens the same way on the laptop. **Unpin** in the node's card lets it float again; **Shake** unpins everything and lets the layout settle.
- Node radius scales with how often the entity is mentioned; edge thickness with how many scenes back it up.
- A labelled edge — a relationship you drew, one the model read, or a reference — shows its word on the line itself, in small italics; click the word or the line for the card. When two nodes are joined more than once (*man owns horse*, *horse helps man*) the edges bend apart so each can be told from, and clicked, on its own. Label size 0 hides these too.
- Bookmarked notes (Obsidian's Bookmarks core plugin) get a ★.
- Click the background or press Esc to deselect. Double-click a node to open its note.

## The panel

The icon top-right toggles a floating panel; its state is remembered.

| Section | What |
|---|---|
| *Head* | Project dropdown; a search box — matching names stay, with their direct neighbours for context. |
| *Actions* | **Read project with model** (see [Reading a project](/guide/model-reading)); **Timeline** opens the [story timeline](/guide/story-timeline); **Threads** opens the [story threads](/guide/story-threads); **Add** a node; **Fit**; **Shake**; **Show all** when a focus is active. |
| **Filters** | Toggle each layer; *Hide loners* removes nodes with no visible edge. |
| **Kinds & colours** | A colour swatch and a toggle per kind, with counts; *Reset colours*. |
| **Display** | Node size, edge thickness, edge opacity, label size (0 hides labels). |
| **Forces** | Repulsion, link distance, link strength, centre pull; *Reset forces*. |
| **Ignored names** | Names you marked *Not a name*, each with **Restore**. |

Everything in the panel persists in the plugin settings and applies to every project.

## The card

Click a node or an edge and a card appears beside it, inside the leaf.

**A node's card**: name, kind (in its colour), aliases, mentions and scene count; then actions —

- **Open note** (typed notes and chapters);
- **Read with model** on a chapter node — reads just that note;
- **Focus** — show only this node and its neighbours (**Show all** returns);
- **Pin / Unpin**;
- **Connect…**, **Rename**, **Delete** on note-backed nodes — see [Drawing the map yourself](#drawing-the-map-yourself);

— then *Appears in* (each row jumps to the scene's heading) and *Connected to* (each row selects that edge).

**An edge's card**: the two names (as buttons that select each node), the summary or relationship label, a stale warning if the scene changed, and the evidence scenes. A relationship you drew has a label field, **Relabel** and **Remove**; a relationship the model read has **Write down**, which keeps it as one of yours.

### Candidates

An unnamed node's card asks **What is this?** and offers every exit:

| Exit | Effect |
|---|---|
| **Character · Place · Item · Faction · Event** | Creates a typed note in the project's `Characters/`, `Places/`, `Items/`, `Factions/` or `Events/` folder (created if missing) with `type:` and empty `aliases:`. The node turns solid in that kind's colour. |
| **Alias of…** | Pick an existing typed note; the name is added to its `aliases`. "Marti" folds into Marta; "Tikka" into the rifle note you made a moment ago. |
| **Not a name** | Written to the project note as `story-ignore: [Name]`. The node disappears; **Restore** in the panel brings it back. |

Brands and gear are *items*, not characters — a rifle in a hunting story carries continuity. A brand that genuinely *is* a character in your story simply gets a character note; the plugin never decides that for you.

## Drawing the map yourself

Nothing on the map is a drawing that lives only on the map. A node you add is a note; a relationship you draw is a line in that note. So the "pull" direction — sketching the schematics of a story before a word of it exists, or reconstructing the web of a novel you are reading — leaves you with a folder of notes you can keep writing in, and syncs like everything else.

### Nodes

**Double-click the background** (or **Add** in the panel): type a name, pick a kind. A typed note is created in the project's `Characters/`, `Places/`, `Items/`, `Factions/` or `Events/` folder, exactly as when you promote an unnamed node, and appears under the cursor, pinned.

A blank map is a folder with one note in it saying `story: true` — no target, no prose, nothing for the writing desk to pace. That is the right project note for a book you are reading rather than writing, too: the map, the model reading and the timeline all work on it; the word goal simply never appears.

**Rename** in the card renames the note; Obsidian updates every link to it, including relationship lines. **Delete** asks twice and moves the note to the trash.

### Relationships

**Connect…** in a node's card (or **Shift-click** a node) starts a line from it; click another node and give the line a label — *sister*, *rival*, *owes a debt*, or nothing. Esc cancels. Both ends must have notes; an unnamed node has to be made into something first.

What gets written is a list line in the first node's note:

```markdown
## Relationships
- [[Ilse]] — sister
- [[The Guild]] — sworn enemy
```

Write those lines by hand if you prefer; the map reads them the same way. Wikilinks, markdown links and bare names all work, and so do `:` and `-` as separators. The section can be `## Relationships` or `## Relations`, at any heading level. Lines under other headings are ignored.

Drawn relationships are **orange** and always painted on top. Their card says which note holds the line and jumps to it.

### When you and the model disagree

You wrote *rival*; the model, reading the scene, says *sister*. Neither is thrown away. Both edges turn **red** — the model's dashed underneath, yours solid on top — and both cards state the disagreement in full: *you wrote "rival"; the model read the prose as "sister"*. From your edge, **Use "sister"** relabels your line; from the model's, **Replace mine with "sister"** does the same. Or leave it: the clash is often the interesting part, and it stays visible until you change one side or re-read the scene.

Same label on both sides is agreement and shows no warning. A relationship only one side mentions is not a conflict either.

## What is read

Every Markdown note in the project folder except:

- notes with `creative-writer: false` in their front matter (memos, research, reviews — they talk *about* the cast in ways that are not scenes);
- typed entity notes, whose prose describes rather than stages (they are nodes, never scenes);
- `Story map.md` and `Story threads.md`, the plugin's own data notes.

Prose-less headings (outlines, checklists) are skipped. Notes are read in path order unless they carry `story-order` (see [Front matter](/reference/front-matter)). The map refreshes about two seconds after you stop editing.

## Sync

Nothing derived is stored — the same notes draw the same map on any machine, and the layout starts deterministically so a story opens the same way everywhere. Relationships you draw are lines in your notes. Only two things persist in `Story map.md` inside the project folder: model readings, and where you pinned nodes by hand. The note travels with the folder through Obsidian Sync or any other method. See [Files & sync](/reference/data-and-sync).
