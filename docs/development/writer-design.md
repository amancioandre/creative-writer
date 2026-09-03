# Writer: design note

Status: **agreed 2026-09-02; all four phases built the same day.** Phase 4: fingerprints and reading status in `Stories.ts`, `BuildWriterStories` with the prose profiler, voice adoption and the reading select in `WriterView`, *Add to writer* in `MythView`. Phase 3: uses in `BuildWriterStories`, `REF` in `Comments.ts`, *Reference a writer card*, named lines and the edge side card in `WriterView`, `Privacy.test.ts`. Phase 2: `domain/writer/Stories.ts`, the stories band in `Layout.ts`, `BuildWriterStories`, `PromoteIdea`, `VaultWriterFiles`, the band and its side cards in `WriterView`. Phase 0: `domain/writer/*`, `BuildWriterBoard`, `VaultWriterNotes`, `WriterFileRepository`, *Copy writer schema*, `reference/writer-file.md`. Phase 1: `domain/writer/Layout.ts`, `views/GraphCanvas.ts`, `views/WriterView.ts`, `VaultWriterTags`, `guide/writer.md`.

Departures from the agreed text, all deliberate:
- The tag prefix lives only in the writer file, edited from the board's panel; settings hold the stories folder and the panel state alone.
- A card is **drawn once**, in its first group, with a chip per group, so the file keeps one position per note. The side panel and the group counts still show it in every group.
- Dropping a card on the background **keeps its tag**; removal is a button on the card's side panel. An accidental drop should not edit a note.
- `GraphCanvas` is new shared code that the writer uses; the story map still carries its own copy of the same mechanics. Migrating the map onto the base is a cleanup for later, kept out of this feature so the map's tests stay untouched.
- Groups **flow** rather than float. After the first pass the user asked that rearranging groups never let them overlap. A saved group rectangle now means size plus order within its layer (by `x`); positions are recomputed on every draw, and dragging a group reorders the row. Card positions are stored **relative to their group** so they travel with it. The protocol page says so.
- Promotion writes `story: true` rather than a `writing-target`, so a fresh story never shows a made-up pace on the desk; the writer adds a target when there is one. Ideas and unfiled folders are **pills** under the story cards rather than cards of their own, because an idea is already a card in the Premises group and drawing it twice would be noise.
- Derived edges (notes that link) were drawn from phase 1; named edges arrived in phase 3, created only from a derived edge (click it, or *Name…* beside a link), so the board never holds a line between notes that do not link.
- `REF` is appended to the comment tag list on every normalisation, so it survives a hand-edited tag list; the writer may recolour it but not remove it.

## 1. Why

The plugin works at three levels: the sentence (editor decorations), the story (a project folder: map, timeline, threads, manuscript, pace) and the vault (writing log, streaks). There is no level for the **writer**: what the author is made of, what they keep returning to, and which stories they are carrying. Today that lives in an Obsidian canvas the plugin cannot read and that does not sync.

The Writer view is that fourth level and the plugin's landing page. It is a *collage*: the vault is the writer's brain, and the board shows only the notes the writer placed on it, grouped by a framework of their choice. It is deliberately **macro and framework-agnostic**. Save the Cat and the Hero's Journey structure one story; the writer level sits beneath every story. Truby's premise chapter (wish list, premise list) is the default framework because it is the one that asks "what do you care about?" rather than "what happens next?".

Story-level structure (acts, beats, character web, moral argument) is **not** on the board. It lives where it already lives: the folder, the story map, the timeline, the threads.

## 2. Ubiquitous language

| Term | Meaning |
|---|---|
| **Writer** | The one board a vault has. Opened with *Open writer* or the ribbon icon. |
| **Framework** | A named set of layers and groups with colours and hints. Shipped: *Truby*, *Generic*. Custom ones are written into the writer file. |
| **Layer** | A band of the board holding groups. Truby: Wish list, Premises, Inspirations, References, Voices. |
| **Group** | A slot in a layer, identified by a tag suffix: `theme`, `archetype`, `poem`… A group is always shown, with a hint when empty. |
| **Card** | Any note in the vault carrying at least one `#writer/<group>` tag. A note can be in several groups. The card is the note; the board owns nothing but its position. |
| **Story** | A declared project (`writing-target` or `story: true`), as everywhere in the plugin. |
| **Idea** | A card in the `premise` group with no `writer-story` link. A premise is a question the writer keeps asking; it may or may not become a story. |
| **Stage** | Where a story is: idea · premise · development · drafting · revising · finished · shelved. |
| **Edge** | A line between two cards. *Derived* edges come from wikilinks between the notes; *named* edges add a label and colour on top and are stored in the writer file. The board never holds an edge between notes that do not link. |
| **Reference (REF)** | A `%% REF: [[Card]] %%` comment in story prose: a link to a card that the manuscript page and export hide, and that the board counts as a use. |
| **Voice** | A card in the `voice` group: a narrator persona a story can adopt. |
| **Use** | A story links to a card, by wikilink or REF. A card used in two or more stories is *recurring*. |

## 3. Declaration: tags on notes

A note joins the board by carrying a nested tag under a configurable prefix (default `writer`):

```yaml
---
tags: [writer/inspiration, writer/poem]
---
```

or inline, `#writer/quote`. Rules:

- Multiple groups per note are allowed and common (a McCarthy line is a `quote` and a `craft` reference).
- A tag whose suffix matches no group of the active framework lands in an **Unsorted** slot so nothing is lost when frameworks change.
- The tag has **no effect on any other feature**. It does not opt the note out of the story map or the writing count; `creative-writer: false` still does that, separately. A card inside a project folder is still that project's note.
- Dragging a card from one group to another on the board rewrites its tag (Obsidian's `processFrontMatter` for front-matter tags; inline tags are edited in place). Dropping it outside every group removes the tag; the note is untouched otherwise.
- Adding a card from the board opens a note picker over the whole vault plus *New note…*; the new note is created in the stories folder if one is set, else beside the writer file, with the tag written.

Why tags and not front matter keys or a list in the board note: one word per group, several groups per note, no note required to point at, visible in the tag pane, cheap for the plugin to rewrite.

## 4. The writer file

One file per vault, custom extension **`.writer`**, JSON inside, registered with `registerExtensions(["writer"], WRITER_VIEW_TYPE)` so that opening it in Obsidian opens the board, exactly as `.canvas` does. Discovered by extension: the first `.writer` file in the vault is the writer; *Open writer* creates `Writer.writer` at the vault root (or in the stories folder, if set) when none exists. No path setting, no folder.

It holds only what the notes cannot: framework choice or definition, colour overrides, card and group positions, named edges, the view transform. Everything else is rebuilt from the vault.

```json
{
  "version": 1,
  "framework": "truby",
  "prefix": "writer",
  "colours": { "theme": "#7a9e7e" },
  "groups": { "theme": { "x": -2600, "y": -500, "w": 460, "h": 760 } },
  "cards":  { "notes/My 7 words.md": { "x": -2240, "y": -2600 } },
  "edges":  [ { "from": "sources/poems/Invictus.md", "to": "storytelling/The Bear Hunt/Outline.md", "label": "inspired by", "colour": "#c9a44c" } ],
  "view":   { "x": 0, "y": 0, "k": 0.35 }
}
```

`framework` is either a shipped id or an inline definition:

```json
{ "name": "Mine", "layers": [ { "name": "Wish list", "groups": [ { "id": "theme", "name": "Themes", "colour": "#7a9e7e", "hint": "What you argue about, story after story." } ] } ] }
```

**Obsidian Sync.** Markdown syncs by default; a `.writer` file travels only when *Sync all other types* is enabled in Sync's selective settings. The guide states this on the first line of the setup section. If the user does not turn it on, the board still works on each machine; only positions and named edges differ between them, because cards, tags, stories and REFs all come from the notes.

**The protocol.** `reference/writer-file.md` documents the file, the tags, the front-matter keys of §6 and the REF comment, with a worked example. *Copy writer schema* puts the same text on the clipboard. This is the migration path for an existing canvas: point an LLM harness at the canvas and the schema and let it write the tags and the file. The plugin ships no importer and writes no schema note into the vault.

## 5. Frameworks

**Truby** (default). Layers and groups, in board order:

| Layer | Groups (tag suffix → label) | Hint when empty |
|---|---|---|
| Wish list | `genre` Genres · `plot` Plots · `theme` Themes · `archetype` Archetypes · `world` Worlds · `dialogue` Dialogues | "Truby's wish list: everything you would love to see in a story, before any story." |
| Premises | `premise` Premises | "One-line story questions. Promote one when it has a home." |
| Inspirations | `poem` Poems · `note` Notes · `music` Music · `video` Videos · `sentiment` Sentiments · `quote` Quotes | "What moves you. Poems, songs, a line someone said." |
| References | `craft` Craft · `research` Research · `reading` Reading | "What teaches you. Analyses, research that outlives one story, the reading list." |
| Voices | `voice` Voices | "Narrators you have built and might adopt again." |

**Generic.** Themes, Characters (`archetype`), Worlds, Ideas (`premise`), Inspirations (`inspiration`), References (`reference`), Voices. Same tag suffixes where the meaning overlaps, so switching frameworks keeps most cards in place.

Switching frameworks changes layers, labels, hints and default colours. Tags stay; unknown suffixes go to Unsorted. Colours are per group, overridable in the side panel, stored in the writer file.

## 6. Stories, ideas, stages, promotion

**Stories row.** Every declared project in the vault, as a card: name, stage chip, premise sentence, voice (if adopted), cast size, last worked on (from the writing log), and buttons to open map, timeline, threads, manuscript and desk for that project. Pace is *not* repeated here beyond one line; the desk owns it.

**Ideas.** Cards in `premise` with no `writer-story` link, listed beside the stories. Not manageable by the rest of the plugin until promoted, by design.

**Unfiled.** If a *Stories folder* is set in settings, folders directly under it that contain prose notes and no project declaration are listed in a small row with *Declare…*. Without a stories folder, nothing is listed.

**Front matter on the project note** (any note in the folder, as today):

| Key | Values | Set by |
|---|---|---|
| `writing-stage` | `development` · `drafting` · `revising` · `finished` · `shelved` | Promotion writes `development`; the writer edits. `drafting` is inferred once prose exists and `finished` once the target is met, unless the key says otherwise. `idea` and `premise` are never written: they are the states of a card without a folder. |
| `writing-premise` | one sentence | Promotion copies the idea note's first paragraph; the writer edits. |
| `writing-idea` | `"[[Idea note]]"` | Promotion. |
| `writing-voice` | `"[[Voice note]]"` | The writer, or *Adopt voice* on the story card. |

**Front matter on the idea note:**

| Key | Values | Set by |
|---|---|---|
| `writer-story` | `"[[Project note]]"` | Promotion. The idea keeps its tag and stays where it is; it now shows a link chip. |

**Promotion** (*Make this idea a story* on an idea card, or the command on the active note): a modal asks for the name and the location (default: the stories folder), then creates the folder. If a folder anywhere in the vault carries `story-template: true` on a note, that folder is copied with `{{name}}` substituted in note names and text; otherwise the plugin generates the documented shape from `guide/story-projects.md`:

```
<Name>/
├── <Name>.md          writing-target, writing-stage, writing-premise, writing-idea
├── Characters/  Places/  Items/
├── Act I/  Act II/  Act III/
└── _Work/             creative-writer: false
```

The scaffold is one shape for every framework: less to learn, and every downstream feature reads it correctly. It writes the two links, and opens the new project note.

## 7. The board

Built on the story map's rendering, extracted into a shared base (`infrastructure/obsidian/views/GraphCanvas.ts`): SVG viewport, pan, zoom, fit, drag, selection, the floating side panel, the hover card. The story map keeps its simulation; the writer has none. Positions are manual, persisted in the writer file with a debounce, like pinned nodes today.

- **Layers** are horizontal bands; **groups** are labelled, coloured, resizable rounded regions inside them. A new vault gets a default layout computed from the framework so the board is legible before anything is placed.
- **Cards** at fit zoom are a title and a colour chip per group they belong to. Past a zoom threshold they show their first lines. Hover shows the note's first paragraph in a card; click selects and fills the side panel with the note's groups, uses, stories that link to it, and *Open note*. Double-click opens the note.
- **Empty groups** show their hint in muted text and accept drops.
- **Edges.** Derived edges are drawn faint and unlabelled between cards that link. Selecting an edge or drawing one between two linked cards lets you name it (free text, with the framework's suggestions: *inspired by*, *contradicts*, *same theme*, *adopted*) and colour it. A named edge whose underlying link disappears is drawn dashed and offered for removal.
- **Side panel** (top right, toggleable): framework picker, group colours, tag prefix, show/hide layers, search, *Fit*, *Copy writer schema*.
- Zen Mode hides the view like every other panel. Desktop only.

## 8. Uses, REF comments, recurrence

A story *uses* a card when a note in the project links to it. Two sources:

1. Plain `[[wikilinks]]` in any note of the project.
2. `%% REF: [[Card]] %%` comments in prose. `REF` becomes a built-in comment tag in `domain/manuscript/Comments.ts` with its own colour. Because the manuscript page already lists comments in the side pane and the export already strips inline comments, a REF is hidden from the reader's page and from any future PDF for free. The editor command *Reference a writer card* inserts one at the cursor from a card picker. REF comments are never auto-created.

Per card, the side panel shows *Used in N stories* with the list. A card used in two or more stories carries a **recurring** mark on the board. That, plus each story's *last worked on*, is the whole of "evolution" for now; the simplest idea wins.

## 9. Voices and the style fingerprint

A voice is a card in `voice`. A story adopts it with `writing-voice`. The story card shows the voice; the voice's side panel lists the stories that adopted it. Later phase: `ProfileProse` aggregated per project (sentence rhythm, reading ease, dialogue share) shown on the story card as a fingerprint strip, and grouped per voice in the voice's panel, so the writer sees whether the voice on the page matches the voice on the card.

## 10. Reading list

A `reading` card may carry `reading: to-read | reading | read`. The board shows a status chip and, when the note links to an analysis note, an *Analysis* chip. Nothing else.

## 11. Myth roll-up

The myth analysis (`MythView`) gains *Add to writer* on an archetype finding: pick an existing `archetype` card to attach a REF to the current scene, or create a new archetype note (stories folder or beside the writer file) with the tag and the finding's text. Flow is one-way, story to writer.

## 12. Privacy

The board is the writer's most private thing. It is read only back to the vault owner.

- Cards are ordinary notes; nothing on the board is exported by the manuscript, written by threads, or logged by the desk.
- No board content is ever put in a model prompt. Scene text sent to the model has comments (including REF) stripped; cards outside the project are never read. Verified by a test in phase 3.
- The board has no effect on the story map, and the story map none on the board (separation of concerns). A link from a character note to an archetype card is a link like any other; the map shows it as an *Outside* node as it does today.
- Local analysis (myth, prose profile) may read story text and produce suggestions for the board; the board itself is never an input.

## 13. Settings (data.json)

| Setting | Default | Effect |
|---|---|---|
| Stories folder | none | Default location for promotion and new cards; enables the Unfiled row. |
| Writer tag prefix | `writer` | The nested-tag prefix. Also stored in the writer file so an LLM reading the file knows it. |

No path setting for the writer file: discovered by extension.

## 14. Phases

Each phase ends installable and QA'd in the dev vault (`vault-qa-loop`), with docs and a changelog entry.

| Phase | Ships | Main modules |
|---|---|---|
| **0 · Model and protocol** | `domain/writer/`: Framework, Board (cards from tags, groups, layers), WriterFile (parse/serialise, version), Uses (links + REF). `reference/writer-file.md`. *Copy writer schema* command. Tests for tag parsing, multi-group, unknown suffix, file round-trip. | `domain/writer/*`, `application/use-cases/BuildWriterBoard.ts`, `infrastructure/obsidian/WriterFileRepository.ts` |
| **1 · The board** | Writer view: layers, groups with hints, cards with chips, hover card, side panel, fit/zoom/pan/drag, positions and colours persisted, framework switch, tag rewrite on drag, add card via picker. `.writer` registered as a view. Ribbon icon and *Open writer*. Guide page. | `views/GraphCanvas.ts` (extracted from StoryMapView), `views/WriterView.ts` |
| **2 · Stories** | Stories row, ideas, stages (declared + inferred), unfiled row, promotion with scaffold and template folder, front-matter keys, links both ways. | `domain/writer/Stage.ts`, `application/use-cases/PromoteIdea.ts`, `infrastructure/obsidian/VaultScaffold.ts` |
| **3 · Uses and edges** | REF comment tag, *Reference a writer card* command, uses per card, recurring mark, derived and named edges, privacy test. | `domain/manuscript/Comments.ts`, `domain/writer/Uses.ts` |
| **4 · Voices and reading** | Voice adoption, style fingerprint strip per story and per voice, reading statuses, myth roll-up. | `application/use-cases/ProfileProse.ts`, `views/MythView.ts` |

## 15. Follow-ups, out of scope here

- **Retire the `Creative Writer/` folder.** The writing log moved into the vault on 2026-08-24 to sync between machines. Under Obsidian Sync, plugin `data.json` syncs when *Installed community plugins* is on, which would let the log return to plugin data and the folder disappear. To decide separately, after confirming the Sync behaviour on both machines.
- Kanban compatibility: dropped.
