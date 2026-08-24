# Story map

One graph of a [project](/guide/projects): the people, places and things of the story as nodes; how they are connected as edges, in three layers you can switch on and off. Open it from the ribbon (the fork icon) or with **Open story map**.

::: tip Not a `.canvas`
The map is drawn by the plugin as SVG, not as an Obsidian Canvas file. Nothing is written to your vault to draw it; the graph is rebuilt from your notes every time.
:::

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
| **Links** (grey) | *linked* — a wikilink one note makes to another; *appears* — an entity and the chapter it is mentioned in | `metadataCache`; the writer's own links |
| **Scenes** (accent colour) | *N scenes together* — two entities mentioned in the same scene, thicker with more shared scenes; *labelled relationships* ("sister", "owes money to") | offline extraction; the model reading |
| **References** (purple) | an entity → an outside reference, labelled with the model's note ("myth: descent with a rule not to look back") | the model reading |

A **scene** is a heading and the prose under it. Every extracted edge carries the scenes that justify it; click the edge to see them and jump to any.

Edges from a model reading whose scene has changed since are drawn **dashed** (stale) rather than dropped — re-read the note to refresh them.

## The map itself

- **Pan** by dragging the background; **zoom** with the wheel (around the cursor); **Fit** in the panel frames everything.
- Nodes settle under a live force simulation and stop moving after a few seconds. **Drag** a node and its neighbours react. **Pin** (in the node's card) holds it where you put it; **Shake** unpins everything and lets the layout settle again.
- Node radius scales with how often the entity is mentioned; edge thickness with how many scenes back it up.
- Bookmarked notes (Obsidian's Bookmarks core plugin) get a ★.
- Click the background or press Esc to deselect. Double-click a node to open its note.

## The panel

The icon top-right toggles a floating panel; its state is remembered.

| Section | What |
|---|---|
| *Head* | Project dropdown; a search box — matching names stay, with their direct neighbours for context. |
| *Actions* | **Read project with model** (see [Reading a project](/guide/model-reading)); **Timeline** opens the [story timeline](/guide/story-timeline); **Fit**; **Shake**; **Show all** when a focus is active. |
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

— then *Appears in* (each row jumps to the scene's heading) and *Connected to* (each row selects that edge).

**An edge's card**: the two names (as buttons that select each node), the summary or relationship label, a stale warning if the scene changed, and the evidence scenes.

### Candidates

An unnamed node's card asks **What is this?** and offers every exit:

| Exit | Effect |
|---|---|
| **Character · Place · Item · Faction · Event** | Creates a typed note in the project's `Characters/`, `Places/`, `Items/`, `Factions/` or `Events/` folder (created if missing) with `type:` and empty `aliases:`. The node turns solid in that kind's colour. |
| **Alias of…** | Pick an existing typed note; the name is added to its `aliases`. "Marti" folds into Marta; "Tikka" into the rifle note you made a moment ago. |
| **Not a name** | Written to the project note as `story-ignore: [Name]`. The node disappears; **Restore** in the panel brings it back. |

Brands and gear are *items*, not characters — a rifle in a hunting story carries continuity. A brand that genuinely *is* a character in your story simply gets a character note; the plugin never decides that for you.

## What is read

Every Markdown note in the project folder except:

- notes with `creative-writer: false` in their front matter (memos, research, reviews — they talk *about* the cast in ways that are not scenes);
- typed entity notes, whose prose describes rather than stages (they are nodes, never scenes);
- `Story map.md`, the plugin's own data note.

Prose-less headings (outlines, checklists) are skipped. The map refreshes about two seconds after you stop editing.

## Sync

Nothing derived is stored — the same notes draw the same map on any machine, and the layout starts deterministically so a story opens the same way everywhere. Only model readings persist, in `Story map.md` inside the project folder, which travels with the folder through Obsidian Sync or any other method. See [Files & sync](/reference/data-and-sync).
