# Creative Writer

Repository: [github.com/amancioandre/creative-writer](https://github.com/amancioandre/creative-writer)

An Obsidian plugin for creative writing. Everything that touches the page lives in the editor; everything about the work (progress, goals, readability) lives in a side panel that Zen Mode hides.

| Feature | What it does | Command / setting |
|---|---|---|
| **Where it runs** | Every note, only notes marked `creative-writer: true`, or only listed folders. A note's front matter (`creative-writer: true` / `false`) always wins. Two commands: toggle everywhere, toggle for this note (writes the property). | Settings → Where it runs; `Toggle Creative Writer (everywhere)`, `Toggle Creative Writer for this note` |
| **Zen Mode** | Hides ribbon, tabs, sidebars, status bar. Optional fullscreen. | `creative-writer: Toggle Zen Mode` |
| **Typewriter scrolling** | Keeps the line you're writing vertically centred. | Settings → Typewriter scrolling |
| **Current line** | A faint band across the editor behind the line you are writing — the visual line, not the paragraph — so it stands out even inside a focused paragraph. | Settings → Current line |
| **Focus fade** | Three-level hierarchy: the line you are on at full strength; the rest of its paragraph slightly veiled; other paragraphs faded progressively by distance. Both strengths are sliders. | Settings → Focus fade / Paragraph strength / Far text strength |
| **Paragraph rhythm** | Underlines each sentence of the current paragraph, cool → warm by "effective length". | Settings → Paragraph rhythm / Rhythm tiers |
| **Model assistant** | Optional. A local model (Ollama) adds contextual findings — clichés in context, tired metaphors, passives hiding an agent — on command, or after a pause if you opt in. | `Analyse paragraph with model`; Settings → Model assistant |
| **Myth & archetype** | Select a scene, get a sidebar report: mythic patterns, archetypes, what the pattern asks next. Local model, on command. | `Analyse selection for myth and archetype` |
| **Readability** | Status bar shows the current paragraph's reading-ease band (Flesch) and sentence-rhythm band (monotone → dynamic). Click it, or run the command, for the **Writing desk**: the whole note's reading ease, grade level, sentence rhythm and dialogue share, each as a named band with a hint. | `Open writing desk`; Settings → Readability in status bar |
| **Writing desk** | Words added and cut today against a daily goal, streak, this week's total, and a 12-week calendar heatmap. Deletions are tracked separately, so a revision day still shows as work. History lives in `progress.json` beside the plugin's settings. | `Open writing desk`; Settings → Goals |
| **Project targets** | Add `writing-target: 50000` (and optionally `writing-deadline: 2026-10-31`) to any note's front matter and its folder becomes a project: total words, words per day needed vs. your last-7-day pace, and the projected finish date. `writing-daily: 500` adds a per-project daily goal with its own streak; `writing-scope: note` limits it to that note; `writing-name` overrides the title. | Writing desk → Projects |
| **Scene outline** | The desk lists the active note's headings with words, reading-ease band and dialogue share per scene, bar-scaled to the longest; click to jump. Heatmap days where cutting outweighed adding are shown as revision days. | Writing desk → Scenes |
| **Story map** | One graph of a project: characters, places and things as nodes (typed notes — `type: character` / `type: location` in front matter, or a `Characters/` / `Places/` folder — plus recurring unnamed names as dashed *candidates* you can turn into notes with one click); three toggleable layers of edges — **Links** you wrote (wikilinks, backlinks, bookmarks ★), **Scenes** shared (who appears with whom, weighted by count), **References** a local model spots outside the story (myth, history, literature) along with labelled relationships and events. The graph fills the tab like Obsidian's graph view: pan by dragging, zoom with the wheel, drag nodes (pin them to hold), a floating panel top-right for project, search, layer/kind toggles, per-kind colours and the force sliders (repulsion, link distance, link strength, centre pull — all persisted), and a floating card beside whatever you click with its actions (open, read with model, make character/place, focus, pin) and evidence. Everything is rebuilt from your notes; only model readings persist, in a `Story map.md` note inside the project folder, so it syncs with the project to every device. | `Open story map`; panel button *Read project with model* (Ollama), or *Read with model* on a chapter's card |
| **Story timeline** | Who is where: every scene of the project in reading order down the side, the cast across the top, a dot where someone is present, model-read events under each scene. The shape a story's absences make. Click a scene to jump, a name to open the note. | `Open story timeline`; *Timeline* button in the story map panel |
| **Style checks** | Tints clichés, passive voice, filter verbs, adverbs, repetition, nominalisations, weak verbs and metaphor candidates in the current paragraph; hover for the note. Offline: rules + a POS tagger + concreteness norms. | Settings → Style checks (per-kind toggles) |

Editing mode only (Source + Live Preview); Reading view has no CodeMirror and is untouched.

How to lay out a project folder so the story map and timeline read it well — typed notes, aliases, opting memos out with `creative-writer: false` — is in [docs/STORY-PROJECTS.md](docs/STORY-PROJECTS.md).

## Pair it with Harper

Install [Harper](https://writewithharper.com) alongside this plugin — it is the intended companion, not an alternative. Harper is a free, offline grammar and spelling checker with its own Obsidian plugin; Creative Writer deliberately does **not** check spelling, grammar, punctuation, agreement, homophones, or intensifiers/hedges/filler words ("very", "quite", "just") because Harper already does those well (`boring_words`, `filler_words`, `hedging`, `long_sentences`, and ~350 more rules).

The split: **Harper edits the sentence, Creative Writer edits the prose.** Passive voice, filter verbs, nominalisations, clichés, metaphor, rhythm and readability are craft judgements no grammar checker makes; they stay here. Both plugins decorate the editor, so their marks can overlap on the same span — Harper underlines, Creative Writer tints, and the two are readable together.

## Quick start

```bash
npm install
npm run build                                  # typecheck + bundle → main.js
npm run install:vault -- /path/to/test-vault   # copies main.js, manifest.json, styles.css
```

Then in Obsidian: Settings → Community plugins → enable **Creative Writer**, and reload (Ctrl/Cmd+R).
`docs/QA-Rhythm-Sample.md` is a note written to exercise every feature — drop it in the vault.

For development: `npm run dev` (esbuild watch) plus the **Hot Reload** community plugin.

```bash
npm test              # 554 tests
npm run eval          # rule scorecard on eval/corpus.ts (see eval/RESULTS.md)
npm run eval:ollama   # the same corpus through the local model, ~1s
npm run test:watch
npm run test:coverage # thresholds: 90% lines/functions/statements, 85% branches
npm run typecheck
```

## Architecture

Clean Architecture, dependencies point inward. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
src/
├── domain/           pure TypeScript, no imports from outside this folder
│   ├── rhythm/       Sentence, SentenceMetrics, SyllableEstimator, RhythmScale,
│   │                 RhythmClassifier, AbbreviationMerger
│   ├── text/         LineSource (port), Paragraph, ProseParagraphs, Scenes, Dialogue
│   ├── readability/  Flesch reading ease / grade, variety and dialogue bands
│   ├── progress/     Dates, WritingLog, ProgressSummary (streak, heatmap, session kind), Project
│   ├── style/        Finding, Tokenizer, StyleRule (+AnalysisContext), PosTagger & Concreteness
│   │                 (ports), rules/ (Cliche, PassiveVoice, FilterVerb, Adverb, Repetition,
│   │                 Nominalization, WeakVerb, MetaphorCandidate, PhraseMatcher), lexicon/
│   ├── story/        StoryGraph, EntityIndex (+NameLookup), Mentions, BuildGraph, Filter, Layout,
│   │                 StoryMapFile (the syncable note), SceneReading (model validation)
│   ├── focus/        FocusTier
│   ├── zen/          ZenMode
│   └── settings/     PluginSettings, normalizeSettings
├── application/      use cases + the ports they need
│   ├── ports/        SentenceSegmenter, WorkspaceChrome, SettingsRepository, ProgressRepository,
│   │                 ParagraphAnalyser, LlmAnalyser, MythAnalyser, HttpClient, Timers
│   └── use-cases/    AnalyzeParagraphRhythm, AnalyzeParagraphStyle, ScheduleAnalysis, ProfileProse,
│                     TrackWriting, AnalyzeParagraphWithLlm, AnalyzeMyth, ComputeFocusFade, ToggleZenMode
├── infrastructure/   adapters — the only place CodeMirror and Obsidian appear
│   ├── segmentation/ IntlSentenceSegmenter
│   ├── nlp/          CompromiseTagger, BrysbaertConcreteness (+ generated data)
│   ├── llm/          OllamaAnalyser, OllamaMythAnalyser, ClaudeAnalyser (untested live),
│   │                 ConfiguredLlmAnalyser, prompts/ (style + myth rulebooks)
│   ├── codemirror/   settingsFacet, typewriter/currentLine/focusFade/rhythm/style/readabilityStatus extensions
│   └── obsidian/     DomWorkspaceChrome, PluginDataSettingsRepository, AdapterProgressRepository,
│                     SettingsTab, RequestUrlHttpClient, views/MythView, views/DeskView
└── main.ts           composition root — wiring only
```

`styles.css` owns every visual. The code only toggles classes:
`body.czm-zen`, `.czm-typewriter`, `.czm-current-line` (a CM layer below the text), `.czm-paragraph-veil` (a layer above it), `.czm-focus-fade` + `.czm-focus-{0..3}`, `.czm-rhythm-{1..6}`, `.czm-style-{kind}`.

## Data and dependencies

- [`compromise`](https://github.com/spencermountain/compromise) (MIT) — part-of-speech tagging, the plugin's only runtime dependency.
- Concreteness norms: Brysbaert, Warriner & Kuperman (2014), *Concreteness ratings for 40 thousand generally known English word lemmas*, Behavior Research Methods — CC-BY 4.0. `data/` holds the source; `npm run build:concreteness` regenerates the bundled subset (16k lemmas, SUBTLEX ≥ 20).

## Models

Everything up to and including the style checks is offline and deterministic. The model assistant and myth analysis need [Ollama](https://ollama.com) running locally (`ollama pull qwen2.5:7b` for style, `deepseek-r1:14b` does noticeably better for myth). A Claude adapter exists behind the same port but has not been exercised against the live API. See [eval/RESULTS.md](eval/RESULTS.md) for what the models actually score — the short version is that the rules beat a local 7B at every mechanical check, so the model is on-command by default.
