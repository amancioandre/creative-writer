# Structuring a story project

The story map, the timeline and the project targets all read the same thing: **a folder** whose notes are your story. What is in that folder shapes what you see, so it pays to keep the story and the work *about* the story apart.

## The shape that works

```
My Novel/
├── My Novel.md                 ← front matter: writing-target: 80000 (this makes the folder a project)
├── Characters/                 ← one note per person; the folder name types them
│   ├── Marta Kovács.md         ← optional front matter: aliases: [Marti, M.]
│   └── Ilse.md
├── Places/                     ← one note per place (Locations/, World/, Settings/ also work)
│   └── Lisbon.md
├── Items/  Factions/  Events/  ← optional, same idea
├── Act I/                      ← chapters and scenes: plain notes with headings
│   ├── 01 The Mountains.md     ←   # or ## headings split a note into scenes
│   └── 02 Camp.md
├── Act II/
└── _Work/                      ← memos, research, reviews, model transcripts
    ├── 2026-06-13-state-of-story.md   ← front matter: creative-writer: false
    └── Review Guide.md                ← front matter: creative-writer: false
```

Rules of thumb:

- **Typed notes are the cast.** A note is a character, place, item, faction or event when its front matter says `type: character` (or `place`, `location`, `item`, `faction`, `event`), or when it sits in a folder named like one (`Characters/`, `People/`, `Cast/`, `Places/`, `Locations/`, `World/`, `Items/`, `Factions/`, `Events/`). Typed notes are never read as scenes — their prose does not create edges.
- **`aliases:`** (Obsidian's own property) tells the map that "Marti" is Marta. A unique surname or given name resolves on its own; an ambiguous one ("Kovács" when there are two) does not.
- **Every other note in the folder is story.** Its headings become scenes; the names in its prose become mentions, co-occurrences and timeline dots. Prose-less headings (outlines, checklists) are skipped.
- **Names that recur three times without a note become dashed *candidates*.** Click one in the map and say what it is: **Character · Place · Item · Faction · Event** creates the typed note in the matching folder; **Alias of…** adds the name to an existing note's `aliases` ("Marti" → Marta, "Tikka" → the rifle you already made); **Not a name** writes it to the project note as `story-ignore` (undo from the panel's *Ignored names*). Brands and gear are *items* — a rifle in a hunting story carries continuity, so give it a note rather than ignoring it; a brand that is genuinely a character in your story can be one. Pronouns, verbs, adjectives, numbers and dialogue openers are vetoed by a part-of-speech check before they ever become candidates.
- **Opt work notes out with `creative-writer: false`.** Memos, research, review guides and model transcripts talk *about* the cast in ways that are not scenes ("Act III is stateless", "check it against Stand by Me"). That front matter line removes the note from the story map and timeline (it also switches the editor features off for that note, which is usually what you want in a memo). A `_Work/` or `memos/` folder makes this a habit; the flag is what matters, not the folder name.
- **Project targets count the whole folder** (`writing-target`, `writing-daily`) — including opted-out notes. If you want a memo folder outside the word count, move it beside the project folder rather than inside it, or give the target note `writing-scope: note`.
- **`Story map.md`** appears in the project folder after the first model reading. It holds only what the model inferred (relationships, references, events per scene) and travels with the folder through Obsidian Sync. Safe to delete; you would re-run the reading.

## A smaller shape

A short story or a novella does not need the folders:

```
The Bear Hunt/
├── The Bear Hunt.md      ← writing-target (+ story-ignore: [LOW, POV]) + the whole draft, one # heading per scene
├── Vitaliy.md            ← type: character
├── Lee.md                ← type: character
├── Tikka T3x.md          ← type: item, aliases: [Tikka, the rifle]
└── memos/                ← creative-writer: false in each
```

## What the map cannot do for you

- It does not know that "the boy" is Zak. Mentions are names; pronouns and epithets are invisible to the offline pass. The model reading (*Read project with model*) sees them, but only reports relationships between names it was given.
- It does not split scenes at `---` or blank lines — only at headings. Give each scene a heading and the timeline gets a row.
- It reads Markdown prose, not Canvas files.
