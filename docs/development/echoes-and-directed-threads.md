# Echoes and directed threads: design and plan

Status: **built 2026-09-13, all seven increments, in one pass after the plan was agreed.** Increment 7 (intent reading) sits beside 6 as designed: the map stays deterministic, the model proposes, the writer clicks. Departures from the plan, all deliberate: the surface tier reports *maximal repeated runs* grown from a three-word seed rather than fixed three-to-five-word grams, so a phrase is heard whole and a long verbatim repeat made of small words is not lost; a lexical pair is dropped only when the shared phrase covers most of both sentences, not whenever the two sentences share a phrase; the semantic tier buckets vectors by ten random hyperplanes and compares within one bit so a novel's sentences are not all compared with each other; the manuscript tints nothing inside a rendered paragraph (a gutter mark with the other end in its title, clickable), and the editor tint was left out; the desk keeps its echo list for twenty seconds because it refreshes on every pause in typing. Originally: planned 2026-09-13. Filed as creative-suite [#3 (echo finder)](https://github.com/amancioandre/creative-suite/issues/3) and [#4 (directed threads)](https://github.com/amancioandre/creative-suite/issues/4). Seven increments; each ends in a working, tested, installable plugin. Directed threads go first because the echo finder's *Keep as a motif* writes the syntax they introduce.

## 1. Why

The threads view exists to catch the breaks a reader feels: a fact stated in chapter three that chapter forty contradicts, a clue planted and never paid off. Two things it cannot say today:

- **A planned reversal is not a contradiction.** The only verb for "she dyed her hair" or "the letter was addressed to her mother" is *Dismiss*, which hides the most important thread in the book. Hand-drawn threads exist but are flat lists of scene-level stops: no roles, no position finer than a heading, no way to tell a promise from its payoff.
- **A habit across the book is invisible.** The repetition rule is paragraph-scoped. The phrase reached for every time a character is tired, the image used in chapter three and again in chapter eleven, the sentence rewritten in slightly different words two scenes later: only a reader hears those, because nobody holds forty thousand words in working memory.

Both are pairs. Two sentences, two positions, and a relation between them: *reverses*, *pays off*, *echoes*. The threads view already draws pairs as arcs and already has a card that shows two scenes with two quotes and jumps to either (the contradiction card). The work is to give the arcs roles and positions, and to add one more source of pairs.

Tenets that bind the design: nothing is written into the writer's notes (anchors are quotes, never block ids); everything persisted is markdown beside the manuscript (`Story threads.md`, `Story map.md`); the model is on command only (the semantic tier is last and optional); findings are the machine's and recomputed, threads are the writer's and persist.

## 2. Ubiquitous language

| Term | Meaning |
|---|---|
| **Stop** | One line of a hand-drawn thread: a scene, a role, an optional quote, a note. |
| **Role** | What a stop is in its thread: `plant`, `touch`, `payoff`, `reversal`. A line with no role is a `touch`, so every existing threads note still parses. |
| **Anchor** | A quoted string on a stop line, matched in the scene's prose the way a fact reading's evidence is. It makes the stop a sentence, not a heading. A quote that no longer matches is a broken anchor, reported like a dead link. |
| **Directed thread** | A hand-drawn thread with at least one `plant`. Its plant → `payoff`/`reversal` arcs carry a direction. |
| **Dangling plant** | A plant with no payoff or reversal after it. The promise the reader is still carrying. |
| **Echo** | Two places in the project that say nearly the same thing. A *phrase echo* is a repeated word run; a *sentence echo* is two sentences that resemble each other. |
| **Tier** | How an echo was found: `surface` (repeated stemmed n-gram), `lexical` (cosine over stemmed content words), `semantic` (embeddings from a local model, on command). |
| **Motif** | An echo the writer has claimed. It becomes a hand-drawn thread with a touch at each occurrence and stops being an echo. |
| **Explained contradiction** | A contradiction whose two scenes are the plant and the reversal of a directed thread. It leaves the red count without a dismissal entry. |

## 3. The threads note, extended

```markdown
## The letter
- [[Chapter 3#The station]] — plant: "she pocketed the letter without reading it"
- [[Chapter 12#Dinner]] — touch: first mentioned aloud
- [[Chapter 41#The reading]] — payoff: "the letter had been addressed to her mother"

## Salt on the wind
- [[Chapter 2#Harbour]] — "salt on the wind"
- [[Chapter 19#The crossing]] — "salt on the wind"
```

Grammar of a line, after the link and the separator the parser already accepts (`—`, `–`, `:`, `-`, `--`):

```
[role ":"] [quote] [note]
role  = plant | touch | payoff | reversal        (case-insensitive)
quote = "…" | “…”                                 (one, anywhere in the remainder)
note  = everything else, trimmed
```

The second thread above is what *Keep as a motif* writes: no role, one quote per stop, the thread named after the phrase. It is a plain thread to every existing reader of the note.

## 4. Increments

### 0 — Roles and anchors in the domain

Nothing user-visible changes. The parser reads the new lines, the model carries them, the tests pin them.

- `domain/threads/StoryThreadsNote.ts`: `WriterThreadItem` gains `role: StopRole` and `quote: string | null`. `parseItem` splits role and quote out of the remainder; `formatThreadItem(link, note, role?, quote?)` writes them back in the order above; `upsertThreadItem` takes an optional `{ role, quote }` and, when the line for that scene already exists, keeps its role and quote unless new ones are given. Old fixtures in `tests/domain/threads/StoryThreadsNote.test.ts` must pass untouched.
- `domain/threads/Anchors.ts` (new): `anchorQuote(noteText, sceneLine, nextSceneLine, quote): { line: number; ch: number } | null`. Locates the quote in the raw note between the scene's heading and the next one, tolerant of emphasis marks and curly quotes. Reuse the normalising locator in `domain/style/llm/validateFindings.ts` (export `locate` and `normalise`, or lift them into `domain/text/Locate.ts`; `quoteAppears` already depends on them and `manuscript/Locate.ts` solves the same problem from the other side). Also returns the sentence's span so the manuscript can mark the paragraph block.
- `domain/threads/Thread.ts`: `ThreadRef` gains `role?`, `quote?`, `anchor?: { line; ch } | null` (null when the quote did not match). `Thread` gains `directed: boolean` and `dangling: readonly ThreadRef[]` (plants with no later payoff or reversal).
- `domain/threads/BuildThreads.ts`: resolves anchors for writer stops. It needs the notes' raw text, which `ProjectNote.text` already carries, so `buildThreads` takes a `textOf(path)` lookup, built in `BuildStoryThreads` from the notes it already loads. Scene end line comes from the next scene's `line` in the same note.
- `domain/threads/Strips.ts`: *Open threads (yours)* counts plant → payoff spans when roles exist and falls back to first → last stop otherwise.
- Tests: syntax old and new; a quote with `*emphasis*` and curly quotes anchors; a stale quote gives `anchor: null` and the stop is listed as broken; a plant with no payoff is dangling; a directed thread with a payoff is not.

### 1 — Directed threads on the page, and *This is a reversal*

- `domain/threads/ArcLayout.ts`: `ArcPath` gains `direction: "forward" | null` (set when the pair is plant → payoff/reversal) and `dangling: boolean`. Paint order unchanged.
- `views/StoryThreadsView.ts`: an SVG `<marker>` arrowhead on directed arcs (`.czm-arc-directed`); a dangling plant draws a short stub arc to the right with `.is-dangling`. The arc card shows each stop's role and quote, *Promise* (sets `plant`) and *Pays off here* (sets `payoff`) on a writer stop, and a "No payoff yet" line under a dangling plant. Panel: broken anchors listed with broken links.
- **The contradiction card gains *This is a reversal*** beside *Dismiss*. `EditStoryThread.addReversal(project, name, a, b)` writes two stops: `plant` at `a` with `a.evidence` as the quote, `reversal` at `b` with `b.evidence`, thread named `<subject>'s <attribute>` unless the writer types another in the same prompt the *Add to a thread* flow uses.
- `domain/threads/Facts.ts` / `BuildThreads.ts`: a contradiction is *explained* when a directed writer thread has a plant in scene `a` and a reversal in scene `b` (scene pair only; quotes are not compared, so a hand-written pair also counts). `Contradiction` gains `explainedBy: string | null`. Explained pairs leave the live count, the badge, the red arcs and the *Contradictions per 1k words* strip; the writer thread's own arc draws instead. No dismissal entry is written to `Story map.md`.
- `domain/manuscript/StoryFacts.ts`: `ConflictMark` becomes `GutterMark { path; line; kind: "conflict" | "plant" | "payoff" | "reversal"; text; otherPath; otherLine }`. `conflictMarks` skips explained pairs; a new `threadMarks(threads)` emits one mark per anchored stop of a directed thread at the anchor's line, text naming the other end ("plant · pays off in Chapter 41 › The reading"). `ManuscriptView.decorate` already places marks by line through `blockAt`; the mark gets a click that scrolls the page to the other end's block.
- `main.ts`: the manuscript's `facts()` builds the threads model once and passes both mark kinds.
- Settings: none new. CSS: `.czm-arc-directed`, `.is-dangling`, `.czm-ms-mark.is-plant/.is-payoff/.is-reversal`, all static classes in `styles.css`.
- Docs: `guide/story-threads.md` gets a *Directed threads* section and the new line grammar; `reference/front-matter.md` and `reference/data-and-sync.md` update the `Story threads.md` line.
- Tests: `ArcLayout.test.ts` direction and stub; `StoryThreadsView.test.ts` the reversal button writes two stops and the badge drops by one; `StoryFacts.test.ts` thread marks; `ManuscriptView.test.ts` a plant mark in the gutter.

### 2 — The echo finder, domain only

Pure functions over the project's prose. No view yet; the increment ships with tests and the eval-style fixture.

- `domain/echoes/Echoes.ts` (new). Input: scenes in manuscript order, each with its `SceneRef`, prose and sentence spans (the use case segments through the `SentenceSegmenter` port; the domain never depends on `Intl`). Output:

  ```ts
  interface EchoStop { scene: SceneRef; index: number; paragraph: number; sentence: number; from: number; to: number; text: string }
  interface EchoPair { key: string; tier: "surface" | "lexical" | "semantic"; text: string; a: EchoStop; b: EchoStop; score: number; distance: number /* scenes apart */ }
  interface EchoGroup { key: string; text: string; stops: EchoStop[]; scenes: number; nearest: number }
  ```

- **Surface tier.** Tokenise with `style/Tokenizer.ts`, stem with `stem` from `RepetitionRule.ts`, slide 3- to 5-grams. Drop a gram that is all stopwords, that contains a token `looksLikeName` says is a name or that the entity index resolves, or that is a dialogue tag (`said`, `asked`, `replied` and the rest of a short list). Longest match wins: a 5-gram's occurrences are not also reported as its 3-grams. Group by gram; a group with occurrences in one paragraph only is the repetition rule's business and is dropped.
- **Lexical tier.** Per sentence, a bag of stemmed content words; sentences under six content words skip. Candidate pairs come from an inverted index (sentences sharing at least two stems whose document frequency is under a cap), never all pairs, so a 100k-word novel stays in tens of milliseconds. Cosine over TF-IDF; a pair scores when cosine ≥ 0.6 and the two sentences are in different paragraphs. Threshold is a constant in the module with the corpus test beside it.
- **Score.** Distance flips the meaning: near is worse. `score = similarity × proximity`, where proximity decays with the number of scenes between the stops and floors so a book-wide habit still ranks. The card says which: *tic* (nearest occurrence within two scenes) or *habit* (three or more scenes spanned).
- **Muting by motif.** `mutedBy(echo, writerThreads)`: an echo is muted when a hand-drawn thread has a stop whose quote contains the phrase or equals a sentence of the pair. The threads note is the only persistence.
- `tests/fixtures/echoCorpus.ts`: a few dozen labelled pairs (should match / should not: names, dialogue tags, same paragraph, common phrasing like "at the end of the day" handled by the cliché rule instead). `tests/domain/echoes/Echoes.test.ts` asserts precision and recall floors on it, the way `metaphorCorpus.ts` does, so a threshold change shows up as a number.

### 3 — Echoes in the threads view, and *Keep as a motif*

- `Thread.ts`: `ThreadKind` gains `"echo"`; `ThreadModel` gains `echoes: readonly EchoPair[]`. One thread per `EchoGroup`, refs per occurrence carrying `quote` and `anchor`, label the phrase; sentence echoes are pairs only and become two-stop threads labelled with the first sentence's opening words.
- `Settings.ts`: `ThreadsSettings.kinds.echo` default `false`; `normalizeThreads` fills it for old settings; `THREAD_KINDS` extended.
- `BuildStoryThreads.ts`: takes the `SentenceSegmenter`; segments each scene, calls the echo functions, mutes by the writer threads it already parsed. Result cached in memory by a hash of all scene prose so a panel toggle does not recompute; the vault stays the source of truth.
- `ArcLayout.ts`: rank echo between entity and fact so it never covers red. `StoryThreadsView.ts`: *Follow one echo…* select beside *Follow one name…*; kind title "Echoes across the book"; the arc card shows both quotes, the distance in scenes and words, the tier, the tic/habit line, jumps to either, and **Keep as a motif** → `EditStoryThread.addMotif(project, name, stops)` writing one touch per occurrence with its quote. A muted echo is gone on the next build; *Remove* on the motif thread's card brings it back.
- Strips: `echoes` (count of echo stops per scene) added, off by default in `DEFAULT_THREADS.strips`, labelled as a secondary summary. The comment at the top of `Strips.ts` and the line in `guide/story-threads.md` about sentence-level style change to say: inside a paragraph is the editor's; across scenes is this view's.
- CSS: `.czm-arc-echo` (`var(--color-purple)`), `.czm-th-kind-echo`. Never `.is-contradiction`.
- Docs: *Echoes* section in `guide/story-threads.md`; `reference/commands.md` unchanged (no new command yet).
- Tests: view test for the select, the card, the motif button writing the note, and the badge never counting echoes.

### 4 — The desk list

- `views/DeskView.ts`: `renderEchoes(root, groups, reveal)` under the readability profile for the active project: the top ten groups by scenes spanned, then count, each row the phrase, the count, the span and the nearest distance. Click opens the note at the first occurrence through the same `reveal(ref)` the threads view uses (the desk's `revealLine` is note-local; `main.ts` passes the project-wide one).
- The desk reads the cached model from `BuildStoryThreads`; it does not compute echoes itself.
- Tests: `DeskView.test.ts` row order and click.

### 5 — The manuscript page

- `ManuscriptSettings.showEchoes` (default off) beside `showStory`. With it on, `GutterMark` kind `"echo"` for every unmuted stop, text naming the nearest other occurrence, click scrolling to it. The mark sits on the paragraph block via `blockAt`, which is enough: the rendered paragraph is not re-tinted, because the page renders Obsidian's own markdown and a span injection would fight it. A second click on the mark selects the paragraph so the comment pane's context follows.
- Optional, behind a setting: an `echo` `Finding` kind for the editor, fed from the cached model through `asyncFindingsExtension`, so the current occurrence tints while typing. Off by default; a project-wide result appearing under the cursor as other chapters change is disorienting mid-draft.
- Tests: `ManuscriptView.test.ts` marks appear only with the toggle.

### 6 — The semantic tier (optional, model on command)

- `application/ports/SentenceEmbedder.ts`: `{ name; embed(texts: readonly string[], signal): Promise<number[][]> }`. `infrastructure/llm/OllamaEmbedder.ts` posts to `/api/embed` with the model from a new `Settings → Model → Embedding model` (suggest `nomic-embed-text`). Same `HttpClient` port, same error shape as `OllamaFactAnalyser`.
- `application/use-cases/AnalyzeProjectEchoes.ts`: command **Read project for echoes**. Embeds every sentence of every scene in one pass (batched), finds cross-paragraph pairs above a cosine threshold, and persists **only the pairs**, never the vectors: `Story map.md` version 3 gains `echoes: [{ a, b, hashA, hashB, quoteA, quoteB, score, model }]`. A pair goes stale when either scene's hash changes, drawn dashed like a stale fact. The `semantic` tier merges into the same `EchoPair` list, deduplicated against surface and lexical pairs by scene pair and overlapping spans.
- Tests: adapter against a recorded fixture; the use case with a fake embedder; file round-trip and staleness; deduplication.

## 5. Order and dependencies

```
0 roles+anchors ─► 1 directed view + reversal ─► 2 echo domain ─► 3 echoes in threads + motif ─► 4 desk ─► 5 manuscript ─► (6 semantic)
                                  └─► (7 intent reading)
```

2 depends on 0 only for the motif syntax and could start in parallel. 4 and 5 are independent of each other. 6 and 7 are the two that touch the model; 7 can follow 1 directly, 6 can wait indefinitely.

### 7 — Intent reading: the model proposes, the writer commits

Decided 2026-09-13: whether a contradiction is a planned reversal is a judgement, and judgement is where a model earns its place. But the map the judgement is made on stays deterministic, and the judgement itself is only ever a proposal. Same line as everywhere else in the plugin: the model reads, code decides, the writer commits.

- **The deterministic map** already exists and does not change: contradictions found by code from the facts (`Facts.ts`), scene order, both quotes, and the directed threads the writer owns. An explained contradiction is still a scene-pair match against a directed thread (decision 2 below); the model never sets that flag.
- `application/ports/IntentAnalyser.ts`: `analyse(pair, signal) → unknown`, where the pair is the subject, the attribute, both values, both quotes with a sentence of context either side, and which scene comes first. `infrastructure/llm/OllamaIntentAnalyser.ts` with a rulebook in `prompts/intentRulebook.ts`. The answer is one of `reversal | error | same`, a one-line reason and a confidence. No spans, so no character arithmetic; a 7B model is enough.
- **Validation in the domain**: verdict from the enum only, reason capped, confidence clamped; anything else is dropped. Same discipline as `validateFacts`.
- **Persistence**: verdicts go into `Story map.md` (version 3) keyed by the contradiction key, which is already stable across re-reads and reorderings, with the model name and rulebook version. A verdict goes stale with the contradiction it belongs to.
- **On the card**: "The model reads this as a reversal: *she dyes her hair after the funeral*", then **Accept as a reversal** (writes the directed thread through the same `addReversal` as increment 1) or *Dismiss*. A verdict of `same` offers *Dismiss* with the reason prefilled. Nothing is ever explained or dismissed without a click.
- **Command**: *Read contradictions for intent*, in the threads panel beside *Read project for facts*; on command only, never on idle.
- **Later, the same reading looks ahead**: a payoff or reversal with no plant before it ("a reveal with no setup") is the mirror of the dangling plant, and the model can propose where the plant is or that one is missing.
- **Evaluation first**: `tests/fixtures/intentCorpus.ts`, a few dozen labelled pairs (reversal / error / same), scored in `tests/eval/model.eval.test.ts` and reported in `eval/RESULTS.md`, so the verdict's precision is a number before it reaches a card.
- Can follow increment 1 directly; it does not depend on the echo work.

## 6. Decisions

Confirmed 2026-09-13.

1. **Role words.** `plant`, `touch`, `payoff`, `reversal`, case-insensitive. English only until the first non-English pipeline.
2. **Explained contradictions match by scene pair alone**, deterministically. The judgement of whether a pair is a reversal is the model's proposal (increment 7) and the writer's click; the match that follows the click is code. Tighten to subject matching if two unrelated facts between the same scenes misfire in the QA vault.
3. **Thresholds are starting constants, exposed as one setting.** The constants (n-gram length 3 to 5, six content words, cosine 0.6, proximity floor) live beside the corpus test. Settings → Story threads gets a single *Echo sensitivity* choice, *low / medium / high*, that maps onto them, rather than a knob per constant. Tune the three presets on a real draft in the dev vault before increment 3 ships.
4. **Mobile is out of this plan.** Mobile is the notebook (capture, quick notes), not a platform for these views; the vision's own item covers it. Nothing here adds mobile work.

## 7. Verification per increment

`npm run lint`, `npm run build`, `npm test`, then the vault loop: install into `/home/apollo/obsidian-dev`, a dated QA note that carries a threads note with the new syntax and a chapter with a deliberate echo, opened with the `obsidian://` URI. The QA note for increment 1 also holds two scenes that contradict on purpose, to exercise *This is a reversal*.
