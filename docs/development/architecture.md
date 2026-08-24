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
| Cliche | ~860 curated phrases, token-trie; literal-prone bare idioms ("cats and dogs", "a dead end", "a crescent moon") and preposition stubs ("orbs of", "nestled in") removed in the 2026-08-24 audit | Only what's in the list. Add freely; the hygiene test guards the format. |
| PassiveVoice | modal chain + be/get (+been/being/getting) + adverbs/negation + participle; questions ("Was it sent?"); stative and not-a-participle lists; names skipped; agent scan to sentence end, "by then" excluded | "was painted red" without an agent reads as a state (tagger calls it an adjective) and is skipped. |
| FilterVerb | ~70 perception/cognition forms incl. multi-word ("could see", "found herself", "was aware of"); not inside quotes, not in a noun/passive slot ("a thought", "was decided"), not before a linking preposition ("smelled of"); with a tagger the head must be a verb | "saw" in "I saw him yesterday" (report, not filter) is flagged. Intensifiers, hedges and filler are deliberately left to [Harper](https://writewithharper.com). |
| Adverb | `-ly`, ≥5 letters, minus a non-adverb list (applied even with a tagger) and a structural/stance list ("suddenly", "obviously"); nothing inside quotes; names skipped; dialogue-tag note only when a quote closed in the sentence | "sadly"/"clearly" are ambiguous between stance and manner; the stance reading wins and the manner use is missed. |
| Repetition | Stemmed content word within 30 words (names skipped, stems handle -ies/-ing/doubled consonants); ≥3 sentence openers alike, ≥5 for "the/a/I/it/there" | Deliberate anaphora gets flagged at three. |

## Tier 2: tagger and concreteness

Two more domain-defined ports, both optional — every rule works without them, they only sharpen:

- `PosTagger` (`domain/style/PosTagger.ts`) ← `CompromiseTagger`. Tokens carry tags, offsets, sentence index and a lemma.
- `Concreteness` (`domain/style/Concreteness.ts`) ← `BrysbaertConcreteness`. 1–5 score, lemma fallback for inflections.

`AnalysisContext` is passed to every rule in one `execute()` so the paragraph is tagged once. `AnalyzeParagraphStyle.withDefaultRules(tagger?, concreteness?)` adds `NominalizationRule`, `WeakVerbRule` and `MetaphorCandidateRule` only when their ports are supplied.

`ScheduleAnalysis` + `asyncFindingsExtension` (debounce, abort, LRU keyed by text hash, stale-result hiding) exist for analysers that are too slow to run per keystroke. Nothing in Tier 2 needed them; Tier 3 will.

| Rule | Signal | Known misses |
|---|---|---|
| PassiveVoice (+tagger) | Participle/Passive/PastTense tag, or participle shape (compromise misses "got hit", "was told"); a plain-adjective tag is accepted only with a `by`-agent; stative word only with an agent or `being` | "was closed" with no agent and no context stays unflagged — by design. |
| Nominalization | light verb + noun with a verb inside (map of ~80, plural via lemma; suffix fallback only after make/take/give/do/conduct/perform/carry/provide/offer/put, never for "have"/"reach"; phrasal "carried out", indirect objects and adverbs skipped) | "take a look" is flagged; sometimes it's the right idiom. |
| WeakVerb | sentence ≥ 14 words whose only verbs are copulas (incl. "wasn't", "'s"); finding sits on the main-clause copula, not one after "which/that" | Deliberate descriptive stasis. |
| MetaphorCandidate | concrete verb (≥3.5) / adjective or material noun (≥3.8) with an abstract noun (≤3.4), gap ≥ 0.7, looking through auxiliaries/negation/adverbs; copula + concrete predicate (shell nouns like "the problem was…" excluded); dead-metaphor list, with open figures ("a flood of …") only when the complement is abstract | Verbs the norms rate as abstract ("creep" 3.4, "gnaw" absent) are invisible. Proper nouns, possessives, noun compounds ("office hours") and inscription/transaction verbs ("cut the budget", "signed the treaty") skipped. |

## Tier 3: models

Two more ports, both async, both implemented for Ollama (and Claude, unverified):

```
asyncFindingsExtension ──► ScheduleAnalysis ──► AnalyzeParagraphWithLlm ──► LlmAnalyser (Ollama | Claude)
                                                      │
                                                      └── validateFindings: quote-anchored, never offset-anchored
MythView ◄── AnalyzeMyth ◄── MythAnalyser (Ollama) ──► validateMythReport: evidence must be quoted from the passage
```

Invariants worth knowing:
- **The model never places a mark.** Every finding passes `validateFindings`, which locates the model's quote in the text (case/quote/whitespace-insensitive) and drops anything it cannot find. Same for myth evidence.
- **Rules own the mechanical checks.** `MODEL_KINDS` restricts what the model is asked about; `asyncFindingsExtension` drops model findings that overlap a rule finding of the same kind.
- **Money is counted in one place.** `ConfiguredLlmAnalyser` prices Claude usage with `CostLedger` and enforces the daily cap before the request; spend persists in settings.
- **Nothing runs on idle unless you opt in.** `llm.onIdle` defaults to false; the command always works.

## Story map

A project (a folder with a `writing-target` note) becomes one graph, built in the domain from parsed notes and rendered by a plain-SVG `ItemView`.

```
VaultProjectNotes ──ProjectNote[]──► buildStoryGraph ──StoryGraph──► applyFilter ──► Simulation ──► StoryMapView
                                                                          └──────────────────────► StoryTimelineView
       │                                    ▲
 metadataCache (links, front matter),       │ StoryMapFile (model readings only)
 Bookmarks core plugin                      │
                                 StoryMapNoteRepository ◄── AnalyzeSceneRelations ◄── RelationAnalyser (Ollama)
```

| Term | Meaning | Lives in |
|---|---|---|
| **Entity** | A node: a typed note (character, location, item, faction, event), a plain note, a *candidate* (recurring unknown name), or a *reference* the model named outside the story. | `domain/story/StoryGraph.ts` |
| **Layer** | How an edge is known: `explicit` (links, appearances), `internal` (co-occurrence, model relationships), `external` (model references). Views toggle layers, never edge kinds. | `StoryGraph.layerOf` |
| **Scene** | A heading and its prose (`domain/text/Scenes`); the unit of evidence. Every extracted edge carries the scenes that justify it. | `SceneRef` |
| **Reading** | One model pass over one scene: relations, references, events, and the hash of the prose it read. A hash mismatch marks its edges *stale* rather than dropping them. | `domain/story/StoryMapFile.ts` |

Entity resolution (`EntityIndex`, `Mentions`) is deliberately tagger-free: a capital mid-sentence is a name, sentence-initial capitals count only when they resolve to a known entity or a name already seen mid-sentence elsewhere in the project (two passes in `buildStoryGraph`). Full names, `aliases:`, a leading article and unique name parts all resolve; an ambiguous surname ("Kovács" with two Kovácses) does not. The `NameLookup` is shared with `validateReading`, so the model may say "Marta" and the graph still finds "Marta Kovács".

**Persistence and sync.** The graph is a pure function of the vault, so nothing derived is stored — two machines with the same notes draw the same map (the layout is seeded deterministically for the same reason). Only model readings persist, and they live in `Story map.md` inside the project folder: front matter (`creative-writer-storymap: 1`, `creative-writer: false`) plus one ```json block. A markdown note is the one file type every sync path — Obsidian Sync, git, Syncthing, a shared drive — carries by default; a sidecar `.json` beside the notes is not. Readings are keyed by `path#heading` and hashed, so an edit re-reads one scene, not a chapter; saving after every scene means an abort loses nothing.

**Layout and the view.** `domain/story/Simulation.ts` is a live force model — pairwise repulsion, springs along edges, a centre pull, damping, and an alpha that cools to rest — with the four forces exposed as persisted settings (`storyMap.forces`). It starts on a deterministic golden-angle spiral, keeps surviving nodes in place across graph updates, and honours pins. `StoryMapView` builds the SVG once per filter change and only moves elements per frame (`requestAnimationFrame`, stopped at rest); pan/zoom is a single `<g transform>`; the floating panel is built from Obsidian `Setting` rows (real toggles, colour pickers, sliders) and the floating card is positioned from the selection's world coordinates each frame. `StoryTimelineView` renders the same graph's `timeline` as a scene × cast matrix. `.canvas` files are not used.
