# Settings

Settings → Community plugins → Creative Writer. Everything here is stored in the plugin's `data.json`. The tab has eight groups in the order a writer meets them; a row that only matters while another is on appears when that one is switched on.

## Where it runs

| Setting | Default | What |
|---|---|---|
| Enabled | on | Master switch for the editor features. The *Toggle everywhere* command flips it. |
| Notes | Project folders and every other note | One rule for everything: the notes the editor tools run in are the notes the daily goal, the project totals, the story map and the threads count. A declared project (`writing-target` or `story: true` in a note's front matter) is always in; the mode decides what else is. Side material stays out with `creative-writer: false` in its front matter, wherever it lives; `creative-writer: true` lets a note in whatever the mode. The plugin's own notes (writing log, story map, threads) are never counted. See [Where it runs](/guide/where-it-runs). |
| Folders | — | Shown with *Project folders and these folders*: one vault-relative folder per line. |

## Writing

The editor while you draft. Everything here stays on under any lens.

| Setting | Default | What |
|---|---|---|
| Typewriter scrolling | on | Keep the line you are writing vertically centred. |
| Current line | on | A faint band behind the visual line you are on, so it stands out inside its paragraph. |
| Focus fade | on | Fade lines progressively the further they are from the cursor. |
| Paragraph strength | 0.7 | With Focus fade: how visible the rest of the cursor paragraph is next to the line you are on (1 = no difference). |
| Far text strength | 0.25 | With Focus fade: how visible the paragraphs furthest from the cursor are. Nearer ones sit between this and the paragraph strength. |
| Paragraph rhythm | on | Tint each sentence of the current paragraph by its effective length; in Zen Mode the tint leaves the text for a meter in the margin. See [Rhythm](/guide/rhythm). |
| Rhythm tiers | 6 | With Paragraph rhythm: colour steps in the gradient (4–6). |
| Zen Mode goes fullscreen | off | Also request window fullscreen when Zen Mode is toggled on. |
| Readability in the status bar | on | The current paragraph's reading-ease and sentence-rhythm bands. Click it to open the writing desk with the whole note's profile. |

## Lenses

A [lens](/guide/lenses) is a reading pass: it colours every open note one way at a time. Each lens is also a command with the *Lens:* prefix.

| Setting | Default | What |
|---|---|---|
| Lens | Style checks | The one lens on, everywhere, kept between sessions: none, style checks, dialogue, words, or accents. The status-bar item and the *Lens:* commands are the same switch. |
| Rhythm tint underneath | on | With a lens on: keep the faint [rhythm](/guide/rhythm) tint under it. |
| Kinds | all on | With the style checks lens: one chip per kind (clichés, passive voice, filter verbs, adverbs, repetition, nominalisations, weak verbs, metaphor candidates); click a chip to switch that kind off or on. See [Style checks](/guide/style-checks). |
| Bad words note | `Creative Writer/Bad words.md` | The note holding your own overused words for the words lens: one heading per category, the words under it. A project note can name its own with `bad-words:`. |
| Dialogue marks | Double quotes | How speech is written for the [dialogue lens](/guide/lenses#dialogue): double quotes, single quotes, dash lines (travessão), or none. A project note overrides with `dialogue:`. |
| Thought marks | A sentence or paragraph in italics | How thought is written: italics that make a whole sentence or paragraph (`_He is guessing,_ she thought.`), any italics, single quotes, a custom pattern, or none. A word or two in italics inside a sentence is emphasis and never counts under the default. A project note overrides with `thoughts:`. |
| Thought pattern | — | With *Custom pattern*: a regular expression tested against each paragraph; every match is a thought, or its first group when there is one. |
| Dim narration | on | Under the dialogue lens, fade everything that is not speech or thought. |
| Speaker colours | on | Attribute each line to the cast and tint it in the speaker's colour (`colour:` in the character note, else the palette in cast order) when a tag, a name in the paragraph or your pin says so; grey otherwise, with the guess in the speaker box. Off: one colour. |
| Tag box opens by itself | on | With speaker colours: the speaker box opens when the cursor rests in a line nobody is sure about. Off: only by the *Dialogue: tag the speaker* command. |

## Manuscript

Three groups for the [manuscript](/guide/manuscript) page. *Prose only* and the comments pane are switches at the top of the page itself and are remembered there, not here.

### Manuscript outline

| Setting | Default | What |
|---|---|---|
| Folder levels as headings | 2 | How many folder levels below the project folder become headings. 0 = notes follow one another with no outline. |
| Note names as headings | on | Each note's name above its text. A note whose first heading already is its name shows that heading once. |
| Strip from names | Numbers and separators | What to remove from the start of folder and note names: the sort prefix in `01 - Camp`. *Nothing* keeps names as they are. |
| Custom pattern | `^\d+[\s._)-]*` | With *Custom pattern*: the regular expression removed from the start of names. |
| Nest the notes' own headings | on | Push a note's headings down below the outline, so a scene in a chapter in a part is level three. Off: headings keep the level they have in the note. |

### Manuscript comments

| Setting | Default | What |
|---|---|---|
| Tint tags in the editor | on | Colour the tag word that opens a comment (`%% TODO: … %%`) in the editor. Only inside comments; a TODO in dialogue is left alone. |
| Tags | `TODO`, `FIX`, `CHECK`, `IDEA`, `CUT` | One per line, an uppercase word and a hex colour. A comment that opens with the word and a colon takes the colour, on the page and in the editor. See [Comments and tags](/guide/manuscript#comments-and-tags). |

### Manuscript page

| Setting | Default | What |
|---|---|---|
| Ruler | on | The strip at the top of the page: a segment per section, wide by words, coloured by readability, marked when changed today. Click a segment to go there. |
| Story on the page | off | Cast lines and scene cast in the map's colours, the model's contradictions and the anchored stops of directed threads in the gutter. Builds the story map on each refresh, so it is off by default. |
| Echoes on the page | off | The echo finder's repeated phrases as marks in the gutter, each naming another place the words occur. Builds the story threads on each refresh. |
| Echo sensitivity | Medium | How many [echoes](/guide/story-threads#echoes) the page and the story threads view hear: *Low* reports only the plainest repeats (four-word phrases, near-identical sentences), *Medium* three-word phrases and sentences six content words long that are 60% alike, *High* shorter phrases and looser sentences. One choice instead of a knob per threshold. |
| Voices on the page | off | Who speaks each paragraph, a stripe in the speaker's colour, grey when nobody is sure; the hover box pins. Also a toggle at the top of the page. |
| Reading speed | 250 | Words per minute behind the reading time at the top of the page and beside each section. 100 to 600; adults read prose at about 250. |

## Stories and goals

| Setting | Default | What |
|---|---|---|
| Stories folder | none | Vault-relative folder where your stories live. A promoted idea is scaffolded there, a new writer card goes there, the writer file is created there, and folders under it with prose but no project declaration are listed as unfiled on the writer board. Empty = the vault root, and no unfiled row. See the [writer protocol](/reference/writer-file). |
| Daily word goal | 500 | Words added per day, in the notes the scope takes in, for the streak and the desk's bar. 0 = any day you write counts. |
| Writing log note | `Creative Writer/Writing log.md` | Vault-relative path of the note that keeps the log (words added and cut per day), so streaks sync with the vault. Takes effect at the next save; reload to read from a new path. |

## Model assistant

Only the chosen provider's rows are shown.

| Setting | Default | What |
|---|---|---|
| Model | Off | Off, Local (Ollama) or Claude. A language model reads the current paragraph and adds findings the rules cannot see: clichés in context, tired metaphors, passives that hide an agent. Local Ollama keeps everything on this machine. See [Model assistant](/guide/model-assistant). |
| Ollama URL | `http://localhost:11434` | With Ollama. |
| Ollama model | `qwen2.5:7b` | With Ollama: any chat model you have pulled. qwen2.5:7b and llama3.1:8b follow the JSON format well; reasoning models (deepseek-r1) are slower but better at the myth analysis. |
| Ollama embedding model | `nomic-embed-text` | With Ollama: an embedding model you have pulled, for the [echo finder](/guide/story-threads#echoes)'s sentence pairs. |
| Claude model | Opus 5 | With Claude: Opus 5 ($5 / $25 per million tokens) reads prose far more carefully; Haiku 4.5 ($1 / $5) is the budget option. A paragraph costs roughly a cent on Opus with the rulebook cached. |
| Anthropic API key | — | With Claude. Stored in plain text in `data.json`; if the vault syncs, the key syncs with it. Use a key you can revoke. |
| Daily spending cap (USD) | 1 | With Claude: calls stop at this; 0 = no cap. Shows today's spend. |
| Analyse automatically | off | With a model chosen: run after a pause in typing; otherwise only by the *Analyse paragraph with model* command. |
| Pause before analysing | 1500 ms | With Analyse automatically: quiet time before the model is called (500–10000). |

## Story map

The story map's own settings live in its floating panel rather than the settings tab, because they are things you adjust while looking at the graph. They persist in `data.json` under `storyMap`:

| Group | Settings |
|---|---|
| Filters | Links / Scenes / References layers; Hide loners |
| Kinds & colours | A toggle and a hex colour per kind (Characters, Places, Items, Factions, Events, Notes, Unnamed, Outside) |
| Display | Node size ×0.4–2.5 · Edge thickness ×0.3–3 · Edge opacity 0.1–1 · Label size 0–18 px |
| Forces | Repulsion 0.1–4 · Link distance 30–300 · Link strength 0.05–1 · Centre pull 0–0.5 |
| Panel | Open or closed |

Hand-edited or out-of-range values are clamped to these ranges on load; unknown keys are dropped.

## Story threads

Likewise in the view's own panel, persisted under `threads`:

| Group | Settings | Default |
|---|---|---|
| Threads | Names / Facts / Yours / Echoes | off / on / on / off |
| Contradictions | Only contradictions; Show dismissed | off; off |
| Strips | One toggle per strip | all on |
| Panel | Open or closed | open |

Which entity or echo is being followed and the zoom are not persisted — they are for the session. The echo sensitivity the view uses is the one under Manuscript page above.
