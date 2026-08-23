# creative-writer

Repository: [github.com/amancioandre/creative-writer](https://github.com/amancioandre/creative-writer)

An Obsidian plugin for creative writing. Four features, all inside the editor:

| Feature | What it does | Command / setting |
|---|---|---|
| **Zen Mode** | Hides ribbon, tabs, sidebars, status bar. Optional fullscreen. | `Creative Zen Mode: Toggle Zen Mode` |
| **Typewriter scrolling** | Keeps the line you're writing vertically centred. | Settings → Typewriter scrolling |
| **Focus fade** | Fades lines progressively by distance from the cursor (3 rings). | Settings → Focus fade |
| **Paragraph rhythm** | Underlines each sentence of the current paragraph, cool → warm by "effective length". | Settings → Paragraph rhythm / Rhythm tiers |
| **Model assistant** | Optional. A local model (Ollama) adds contextual findings — clichés in context, tired metaphors, passives hiding an agent — on command, or after a pause if you opt in. | `Analyse paragraph with model`; Settings → Model assistant |
| **Myth & archetype** | Select a scene, get a sidebar report: mythic patterns, archetypes, what the pattern asks next. Local model, on command. | `Analyse selection for myth and archetype` |
| **Style checks** | Tints clichés, passive voice, weak words, filter verbs, adverbs, repetition, nominalisations, weak verbs and metaphor candidates in the current paragraph; hover for the note. Offline: rules + a POS tagger + concreteness norms. | Settings → Style checks (per-kind toggles) |

Editing mode only (Source + Live Preview); Reading view has no CodeMirror and is untouched.

## Quick start

```bash
npm install
npm run build                                  # typecheck + bundle → main.js
npm run install:vault -- /path/to/test-vault   # copies main.js, manifest.json, styles.css
```

Then in Obsidian: Settings → Community plugins → enable **creative-writer**, and reload (Ctrl/Cmd+R).
`docs/QA-Rhythm-Sample.md` is a note written to exercise every feature — drop it in the vault.

For development: `npm run dev` (esbuild watch) plus the **Hot Reload** community plugin.

```bash
npm test              # 296 tests
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
│   ├── text/         LineSource (port), Paragraph (locateParagraph)
│   ├── style/        Finding, Tokenizer, StyleRule (+AnalysisContext), PosTagger & Concreteness
│   │                 (ports), rules/ (Cliche, PassiveVoice, WeakWord, Adverb, Repetition,
│   │                 Nominalization, WeakVerb, MetaphorCandidate, PhraseMatcher), lexicon/
│   ├── focus/        FocusTier
│   ├── zen/          ZenMode
│   └── settings/     PluginSettings, normalizeSettings
├── application/      use cases + the ports they need
│   ├── ports/        SentenceSegmenter, WorkspaceChrome, SettingsRepository, ParagraphAnalyser,
│   │                 LlmAnalyser, MythAnalyser, HttpClient
│   └── use-cases/    AnalyzeParagraphRhythm, AnalyzeParagraphStyle, ScheduleAnalysis,
│                     AnalyzeParagraphWithLlm, AnalyzeMyth, ComputeFocusFade, ToggleZenMode
├── infrastructure/   adapters — the only place CodeMirror and Obsidian appear
│   ├── segmentation/ IntlSentenceSegmenter
│   ├── nlp/          CompromiseTagger, BrysbaertConcreteness (+ generated data)
│   ├── llm/          OllamaAnalyser, OllamaMythAnalyser, ClaudeAnalyser (untested live),
│   │                 ConfiguredLlmAnalyser, prompts/ (style + myth rulebooks)
│   ├── codemirror/   settingsFacet, typewriter/focusFade/rhythm/style extensions
│   └── obsidian/     DomWorkspaceChrome, PluginDataSettingsRepository, SettingsTab,
│                     RequestUrlHttpClient, views/MythView
└── main.ts           composition root — wiring only
```

`styles.css` owns every visual. The code only toggles classes:
`body.czm-zen`, `.czm-typewriter`, `.czm-focus-fade` + `.czm-focus-{0..3}`, `.czm-rhythm-{1..6}`, `.czm-style-{kind}`.

## Data and dependencies

- [`compromise`](https://github.com/spencermountain/compromise) (MIT) — part-of-speech tagging, the plugin's only runtime dependency.
- Concreteness norms: Brysbaert, Warriner & Kuperman (2014), *Concreteness ratings for 40 thousand generally known English word lemmas*, Behavior Research Methods — CC-BY 4.0. `data/` holds the source; `npm run build:concreteness` regenerates the bundled subset (16k lemmas, SUBTLEX ≥ 20).

## Models

Everything up to and including the style checks is offline and deterministic. The model assistant and myth analysis need [Ollama](https://ollama.com) running locally (`ollama pull qwen2.5:7b` for style, `deepseek-r1:14b` does noticeably better for myth). A Claude adapter exists behind the same port but has not been exercised against the live API. See [eval/RESULTS.md](eval/RESULTS.md) for what the models actually score — the short version is that the rules beat a local 7B at every mechanical check, so the model is on-command by default.
