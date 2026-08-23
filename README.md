# Creative Zen Mode

An Obsidian plugin for creative writing. Four features, all inside the editor:

| Feature | What it does | Command / setting |
|---|---|---|
| **Zen Mode** | Hides ribbon, tabs, sidebars, status bar. Optional fullscreen. | `Creative Zen Mode: Toggle Zen Mode` |
| **Typewriter scrolling** | Keeps the line you're writing vertically centred. | Settings → Typewriter scrolling |
| **Focus fade** | Fades lines progressively by distance from the cursor (3 rings). | Settings → Focus fade |
| **Paragraph rhythm** | Underlines each sentence of the current paragraph, cool → warm by "effective length". | Settings → Paragraph rhythm / Rhythm tiers |
| **Style checks** | Tints clichés, passive voice, weak words, filter verbs, adverbs and repetition in the current paragraph; hover for the note. Offline, rule-based. | Settings → Style checks (per-kind toggles) |

Editing mode only (Source + Live Preview); Reading view has no CodeMirror and is untouched.

## Quick start

```bash
npm install
npm run build                                  # typecheck + bundle → main.js
npm run install:vault -- /path/to/test-vault   # copies main.js, manifest.json, styles.css
```

Then in Obsidian: Settings → Community plugins → enable **Creative Zen Mode**, and reload (Ctrl/Cmd+R).
`docs/QA-Rhythm-Sample.md` is a note written to exercise every feature — drop it in the vault.

For development: `npm run dev` (esbuild watch) plus the **Hot Reload** community plugin.

```bash
npm test              # 163 tests, ~1s
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
│   ├── style/        Finding, Tokenizer, StyleRule, rules/ (Cliche, PassiveVoice,
│   │                 WeakWord, Adverb, Repetition, PhraseMatcher), lexicon/ (curated lists)
│   ├── focus/        FocusTier
│   ├── zen/          ZenMode
│   └── settings/     PluginSettings, normalizeSettings
├── application/      use cases + the ports they need
│   ├── ports/        SentenceSegmenter, WorkspaceChrome, SettingsRepository
│   └── use-cases/    AnalyzeParagraphRhythm, AnalyzeParagraphStyle, ComputeFocusFade, ToggleZenMode
├── infrastructure/   adapters — the only place CodeMirror and Obsidian appear
│   ├── segmentation/ IntlSentenceSegmenter
│   ├── codemirror/   settingsFacet, typewriter/focusFade/rhythm/style extensions
│   └── obsidian/     DomWorkspaceChrome, PluginDataSettingsRepository, SettingsTab
└── main.ts           composition root — wiring only
```

`styles.css` owns every visual. The code only toggles classes:
`body.czm-zen`, `.czm-typewriter`, `.czm-focus-fade` + `.czm-focus-{0..3}`, `.czm-rhythm-{1..6}`, `.czm-style-{kind}`.

## Out of scope (by design)

The LLM-backed assistant from the original brief is not implemented yet. Everything here is offline and deterministic. See [docs/ROADMAP.md](docs/ROADMAP.md) for Tiers 2 and 3.
