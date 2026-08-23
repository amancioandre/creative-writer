# Architecture

## The rule

Dependencies point inward. `domain` imports nothing from outside itself. `application` imports `domain`. `infrastructure` imports both and is the only layer that knows CodeMirror or Obsidian exist. `main.ts` wires them together and contains no logic.

You can verify this mechanically:

```bash
grep -rn "from \"@codemirror\|from \"obsidian" src/domain src/application   # → nothing
```

## Ubiquitous language (DDD)

| Term | Meaning | Lives in |
|---|---|---|
| **Sentence** | A span of text with offsets relative to its paragraph. Value object. | `domain/rhythm/Sentence.ts` |
| **Effective length** | Words + commas + half the polysyllabic surplus. The reader's *felt* length. | `RhythmClassifier.effectiveLength` |
| **Rhythm tier** | 1-based bucket of effective length. Tier 1 = shortest. 4–6 tiers. | `RhythmScale` |
| **Rhythm scale** | Absolute boundaries between tiers, so a colour always means the same thing. | `RhythmScale` |
| **Paragraph** | Maximal run of non-blank lines. Markdown syntax is irrelevant to it. | `domain/text/Paragraph.ts` |
| **Focus tier** | Distance-from-cursor bucket: 0 current, 1 near, 2 mid, 3 far. | `domain/focus/FocusTier.ts` |
| **Chrome** | The host UI that Zen Mode hides: ribbon, tabs, sidebars, status bar. | `ports/WorkspaceChrome.ts` |

## The three use cases

```
ToggleZenMode           ZenMode (domain) ──► WorkspaceChrome (port) ──► DomWorkspaceChrome
AnalyzeParagraphRhythm  SentenceSegmenter (port) ──► classifyRhythm (domain) ──► RhythmAnnotation[]
ComputeFocusFade        focusTierFor (domain) ──► LineFocus[]
```

Use cases return plain data. Rendering that data is an infrastructure concern (CM6 decorations).

## How settings flow

```
SettingsTab ──update()──► main.ts ──save──► PluginDataSettingsRepository (data.json)
                             │
                             └──Compartment.reconfigure(settingsFacet.of(next))──► every open editor
                                                                                      │
                                              extensions see settingsChanged(update) ─┘ and rebuild
```

No extension holds a reference to the plugin. They read `state.facet(settingsFacet)`.

## How each feature renders

| Feature | CM6 primitive | CSS hook |
|---|---|---|
| Typewriter | `EditorView.scrollIntoView(head, {y:"center"})` dispatched on the next animation frame; `editorAttributes` adds the class | `.czm-typewriter .cm-content { padding: 45vh 0 }` |
| Focus fade | `ViewPlugin` + `Decoration.line` per visible line | `.czm-focus-{0..3} { opacity }` |
| Rhythm | `ViewPlugin` + `Decoration.mark` per sentence, **only in the cursor's paragraph** | `.czm-rhythm-{1..6} { text-decoration-color }` |
| Zen | none — `document.body.classList` | `body.czm-zen .workspace-ribbon … { display: none }` |

Recompute triggers: `docChanged || selectionSet || settingsChanged` (focus fade also `viewportChanged`). Work is bounded by viewport (fade) or paragraph (rhythm), never by document length.

## Testing strategy (TDD)

Every file under `src/` (except `main.ts`, which is wiring) was written test-first. Tests mirror the source tree under `tests/`.

| Layer | How it's tested | Doubles |
|---|---|---|
| domain | Plain unit tests on pure functions / value objects | none |
| application | Unit tests with hand-written fakes for ports | `FakeChrome`, `fakeSegmenter` |
| infrastructure/codemirror | Real `EditorView` mounted in jsdom; assert on rendered `.cm-line` classes and mark spans | `tests/infrastructure/codemirror/helpers.ts` |
| infrastructure/obsidian | Real DOM for chrome; `tests/stubs/obsidian.ts` stands in for the types-only `obsidian` package | stub |

jsdom has no layout, so scroll *position* cannot be asserted — the typewriter test checks the **policy** (`shouldRecenter`) exhaustively and the **wiring** (a scroll effect is dispatched). Scroll smoothness was verified manually in Obsidian 1.13.4.

## Known limits

- `SyllableEstimator` under-counts vowel hiatus ("po-et"). Fine for bucketing.
- `AbbreviationMerger` has a fixed list. ICU already handles "e.g.", "i.e.", "etc."; the list covers honorifics and common short forms in English and Portuguese.
- Headings, list bullets and blockquote markers are part of the sentence text CM sees. The rhythm of "# Title" includes the hash; harmless, but a Markdown-aware tokenizer would be the next step.
- Rhythm scale boundaries are tuned for English prose. They live in one table in `RhythmScale.withTiers`.

## Style checks (Tier 1)

Each check is a `StyleRule` — `analyse(text) → Finding[]` — in `domain/style/rules/`. They share one `Tokenizer` (lowercased words with exact offsets and a sentence-start flag) and one `PhraseMatcher` (a word-trie; longest match, never across a sentence boundary). Lexicons in `domain/style/lexicon/` are plain data with a hygiene test each (no duplicates, normalised form).

`AnalyzeParagraphStyle` runs the enabled rules over the cursor's paragraph, shifts findings to absolute offsets, and sorts. `styleExtension` renders them as `Decoration.mark` with a `data-czm-note` attribute and a `hoverTooltip` that reads from the same plugin instance.

Each rule's precision/recall trade-off, in one line:

| Rule | Approach | Where it's wrong |
|---|---|---|
| Cliche | 888 curated phrases, token-trie | Only what's in the list. Add freely; the hygiene test guards the format. |
| PassiveVoice | be/get (+modal, +been/being) + adverbs + participle; stative list excluded | "was closed" (state) vs "was closed by" (passive) — we skip it unless "being" is present. |
| WeakWord | 100+ entries with notes; context guards for `so`, `just`, `felt`, `pretty` | "There was" is flagged even when it's the right choice. |
| Adverb | `-ly`, ≥5 letters, minus a non-adverb list; sharper note after a dialogue tag | Rare adjectives not in the list ("ghastly" is). |
| Repetition | Stemmed content word within 30 words; ≥3 sentence openers alike | Deliberate anaphora gets flagged at three. |
