# Testing & evaluation

```bash
npm test              # the whole suite, ~570 tests, under 10 s
npm run test:watch
npm run test:coverage # thresholds: 90 % lines/functions/statements, 85 % branches
npm run typecheck     # sources and tests
npm run eval          # rule scorecard on eval/corpus.ts
npm run eval:ollama   # the same corpus through the local model (OLLAMA_LIVE=1)
```

## How the layers are tested

Tests mirror the source tree under `tests/`. Every file under `src/` except `main.ts` (wiring) was written test-first.

| Layer | How | Doubles |
|---|---|---|
| `domain` | Plain unit tests on pure functions and value objects | none |
| `application` | Unit tests with hand-written fakes for ports | `FakeChrome`, `fakeSegmenter`, in-memory repositories |
| `infrastructure/codemirror` | A real `EditorView` mounted in jsdom; assertions on rendered `.cm-line` classes and mark spans | `tests/infrastructure/codemirror/helpers.ts` |
| `infrastructure/obsidian` | Real DOM; `tests/stubs/obsidian.ts` stands in for the types-only `obsidian` package (`Setting`, `ItemView`, toggles, sliders, colour pickers…) | stub |
| `infrastructure/llm` | Recorded fixtures through a `FakeHttp`; live tests are opt-in | `tests/integration/*.live.test.ts` |

jsdom has no layout, so the typewriter test checks the recentring *policy* exhaustively and the *wiring* (a scroll effect is dispatched); smoothness was verified by hand in Obsidian. The story map's pan/zoom and card placement are tested through the transforms they write, not pixels.

## Rule audits

Each style rule has an adversarial audit of ~300 sentences pinned in `tests/domain/style/audit.test.ts` — negated passives, names as echoes, noun compounds as metaphors, literal "a flood of water". A rule change that regresses any of them fails the build.

## The corpus

`eval/corpus.ts` is 100 labelled sentences (64 with at least one expected kind, 36 clean). Scoring is sentence-level per kind. Results in `eval/RESULTS.md`:

| | micro P | micro R | micro F1 | clean flagged |
|---|---|---|---|---|
| Rules only | 0.85 | 0.67 | 0.75 | 4 / 36 |
| Rules + tagger + norms | **0.96** | **0.97** | **0.97** | 3 / 36 |
| qwen2.5:7b (8 sentences per call) | 0.29 | 0.25 | 0.27 | 20 / 36 |
| deepseek-r1:14b | 0.48 | 0.42 | 0.45 | 0 / 36 |

The remaining rule misses are by design (agentless passives that are correct, "watched the tide go out", metaphor verbs the norms rate as abstract). The model numbers are why the model is on-command and limited to judgement kinds.

## Story map extraction

`tests/infrastructure/nlp/CandidateVeto.test.ts` pins the exact false names a real manuscript produced (He, If, Can, This, Its, Waiting, Better, Twelve…) against the real tagger, and the cast, places and gear that must survive (André, Vitaliy, Bear, Vancouver Island, Tikka…). `tests/domain/story/` covers entity resolution, mention finding with clause starts, graph building, filters, the persisted file, reading validation and the simulation's determinism.

## Manual QA

A dated QA note in a test vault, with *Must show* / *Must stay clean* lines per feature, is the last step before a commit that changes anything user-visible; `docs/QA-Rhythm-Sample.md` is a note written to exercise every editor feature. The build → `npm run install:vault` → reload → check loop is the habit.

## Conventions

- Dependencies point inward: `grep -rn 'from "@codemirror\|from "obsidian' src/domain src/application` must print nothing.
- No `innerHTML` with model text — everything the model says goes in as text nodes.
- Sentence-case settings, no default hotkeys, commands named without the plugin name, `onunload` restores what `onload` changed.
