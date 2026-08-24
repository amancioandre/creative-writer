# Settings

Settings → Community plugins → Creative Writer. Everything here is stored in the plugin's `data.json`.

## General

| Setting | Default | What |
|---|---|---|
| Enabled | on | Master switch for the editor features. |
| Notes | All notes | Which notes get the writing tools; see [Where it runs](/guide/where-it-runs). |
| Folders | — | With *Only these folders*: one vault-relative folder per line. |

## Editor

| Setting | Default | What |
|---|---|---|
| Typewriter scrolling | on | Keep the line you are writing vertically centred. |
| Current line | on | A faint band behind the visual line you are on. |
| Focus fade | on | Fade lines progressively the further they are from the cursor. |
| Paragraph strength | 0.7 | Opacity of the rest of the cursor paragraph. |
| Far text strength | 0.25 | Opacity of the paragraphs furthest from the cursor. |
| Paragraph rhythm | on | Colour each sentence of the current paragraph by effective length. |
| Rhythm tiers | 6 | Colour steps in the gradient (4–6). |
| Fullscreen in Zen Mode | off | Also request window fullscreen. |
| Readability in status bar | on | Show the current paragraph's bands; click to open the desk. |

## Goals

| Setting | Default | What |
|---|---|---|
| Daily word goal | 500 | Words added per day for the streak and the desk's bar. 0 = any day you write counts. |
| Writing log note | `Creative Writer/Writing log.md` | Vault-relative path of the note that keeps the log, so it syncs. Takes effect at the next save; reload to read from a new path. |

## Style checks

A master toggle, then one toggle per kind: Cliché, Passive voice, Filter verb, Adverb, Repetition, Nominalisation, Weak verb, Metaphor candidate. See [Style checks](/guide/style-checks).

## Model assistant

| Setting | Default | What |
|---|---|---|
| Model | Off | Off, Local (Ollama) or Claude. |
| Analyse automatically | off | Run after a pause in typing; otherwise only on command. |
| Pause before analysing | 1500 ms | Quiet time before the model is called (500–10000). |
| Ollama URL | `http://localhost:11434` | |
| Ollama model | `qwen2.5:7b` | Any chat model you have pulled. |
| Claude model | Opus 5 | Opus 5 or Haiku 4.5. |
| Anthropic API key | — | Stored in plain text in `data.json`. |
| Daily spending cap (USD) | 1 | Claude calls stop at this; 0 = no cap. Shows today's spend. |

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
| Threads | Names / Facts / Yours | off / on / on |
| Contradictions | Only contradictions; Show dismissed | off; off |
| Strips | One toggle per strip | all on |
| Panel | Open or closed | open |

Which entity is being followed and the zoom are not persisted — they are for the session.
