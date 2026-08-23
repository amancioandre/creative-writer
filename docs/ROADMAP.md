# Roadmap: Tiers 2 and 3

Tier 1 (rule-based style checks) and Tier 2 (2.0–2.2) shipped 2026-08-23. 2.3 (stats panel) was optional and is not built. This document breaks down the next two tiers into increments that each end in a working, tested, installable plugin. Estimates assume the same cadence as Tier 0/1: one focused session per increment.

The architectural seam for everything below already exists: findings are `Finding { kind, from, to, note }` and render through `styleExtension`. New detectors only need to produce findings; nothing in rendering changes. The one new abstraction is an **async analyser port** — Tier 1 rules are synchronous, Tier 2/3 sources are not.

---

## Tier 2 — local NLP, no LLM ✅ (2.0, 2.1, 2.2 done)

**As built:** tagger-backed rules run synchronously (tag once per paragraph via `AnalysisContext`, ~3 ms typical, 15 ms for a 500-word paragraph), so the async path from 2.0 is wired and tested but reserved for Tier 3. Metaphor candidates use a concreteness *gap* with separate verb/modifier thresholds rather than fixed extremes, plus a copula-predicate pattern ("sorrow was a stone"); 0.87 recall / 0.93 precision on the 30-sentence corpus. Bundle: 593 KB.

Goal: upgrade precision on existing checks and add a metaphor *candidate* detector, all offline, all fast enough to run on idle.

### 2.0 — Async analyser port and idle scheduling (foundation)

**Why first:** every later increment is async. Build the plumbing once.

- `application/ports/ParagraphAnalyser.ts`: `analyse(text, paragraphFrom, signal: AbortSignal): Promise<Finding[]>`
- `application/use-cases/ScheduleAnalysis.ts`: debounce on cursor-idle (600 ms), cancel in-flight on new edit, cache by `hash(paragraphText)` → `Finding[]`, LRU of ~200 paragraphs
- `infrastructure/codemirror/asyncFindingsField.ts`: a `StateField<Finding[]>` updated by a `StateEffect` when results land; `styleExtension` merges sync + async findings
- Tests: fake-timer debounce, abort on edit, cache hit skips analyser, results for a stale paragraph are discarded (hash mismatch)
- **Deliverable:** nothing user-visible changes, but a `DelayedEchoAnalyser` test double proves the loop. ~1 session.

### 2.1 — POS tagging via `compromise`

**Why:** PassiveVoice, Adverb and WeakWord are currently guessing from word shape. A tagger removes the guesswork.

- Add `compromise` (~250 KB, pure JS, no WASM, MIT). It runs in the domain's *infrastructure* adapter, not the domain.
- `infrastructure/nlp/CompromiseTagger.ts` implementing `application/ports/PosTagger.ts` (`tag(text) → TaggedToken[]` with offsets)
- Rewrite `PassiveVoiceRule` to take an optional tagger: with it, require `VerbParticiple` after the auxiliary. Keep the regex path as fallback so the domain stays dependency-free.
- `AdverbRule`: drop the exception list in favour of the tagger's `Adverb` tag; keep the list as an override for the tagger's misses.
- New rule: **NominalizationRule** — `-tion/-ment/-ance` nouns with a weak verb ("made a decision" → "decided"). Only feasible with POS.
- New rule: **WeakVerbRule** — `is/was/has/get/make/do` as the main verb of a clause.
- Tests: each rule against a sentence corpus with known answers; a regression test that tagger-backed passive ≥ regex-backed passive on the corpus.
- **Deliverable:** fewer false positives on passive/adverb, two new checks. ~1–2 sessions.

### 2.2 — Concreteness and metaphor candidates

**Why:** the cheapest useful metaphor signal is "concrete verb applied to abstract noun" (or the reverse). No model training needed.

- Data: Brysbaert et al. concreteness norms (40k English lemmas, CC-BY). Ship as a compressed JSON map `lemma → 1..5`, ~300 KB.
- `infrastructure/nlp/ConcretenessLexicon.ts` → `application/ports/Concreteness.ts`
- Rule: **MetaphorCandidateRule** (needs 2.1's tagger for verb-object pairs): flag `verb(concreteness ≥ 4) + object(concreteness ≤ 2.5)` and `adjective(≥4) + noun(≤2.5)`. Note: "Possible figurative use — 'bruised' applied to 'silence'. Fresh or familiar?"
- Also flag **dead metaphors** by phrase list (a second curated lexicon, ~150 entries: "flood of", "wave of", "iron grip", "heart of the matter") — the list is the precise half, the concreteness rule is the recall half.
- Tests: known metaphor corpus (a few dozen sentences from the VUA metaphor corpus, public) — assert recall ≥ 0.5 and precision ≥ 0.6 on it; the numbers are in the test so regressions are visible.
- **Deliverable:** `metaphor` finding kind, shown with a distinct tint and a hedged note. ~1–2 sessions.

### 2.3 — Paragraph-level readability and sentence-variety panel (optional)

- Sidebar view (Obsidian `ItemView`) showing: sentence-length histogram for the current paragraph, adverb density, passive ratio, reading level (Flesch–Kincaid from the existing syllable estimator).
- Pure presentation over data Tier 1 already computes. Worth doing if you want a dashboard; skip if the inline marks are enough.
- ~1 session.

**Tier 2 total: 3–5 sessions.** After 2.2 the plugin can say "this might be a metaphor" without ever calling a model.

---

## Tier 3 — language models

Goal: judgement calls — is this metaphor fresh, is this cliché *in context*, what myth or archetype is this scene echoing. Two adapters behind one port; local first.

### 3.0 — `SentenceAnalyser` port and the local adapter (Ollama)

- `application/ports/LlmAnalyser.ts`: `analyse(request: { text, context, checks: Kind[] }, signal) → Promise<Finding[]>`
- `infrastructure/llm/OllamaAnalyser.ts`: `requestUrl` (Node-side, no CORS) to `http://localhost:11434/api/chat` with `format` set to a JSON schema. Default model configurable; suggest `qwen2.5:7b` or `llama3.1:8b`; `phi4-mini` as the low-RAM option.
- Prompt as a versioned constant in `infrastructure/llm/prompts/`. System prompt holds the rulebook (what each kind means, with two examples each). User turn is the sentence plus ±2 sentences of context.
- Response validation in the *domain*: `validateFindingSpans(findings, text)` — drop any finding whose `start/end` don't land on token boundaries or whose quoted text doesn't match. Models are unreliable at character arithmetic; this is the single most important guard.
- Runs through 2.0's scheduler with a longer idle (1500 ms) and an explicit **"Analyse paragraph"** command for on-demand use. Default: on-command only; idle mode is opt-in.
- Tests: adapter against a recorded fixture (no network); span validator exhaustively; scheduler integration with a fake analyser.
- **Deliverable:** a working local assistant for `cliche` (contextual), `metaphor` (fresh/tired verdict), `passive` (should it be?). ~2 sessions.

### 3.1 — Claude adapter

- `infrastructure/llm/ClaudeAnalyser.ts`: `@anthropic-ai/sdk` with a `fetch` shim over `requestUrl`, or raw `requestUrl` to `/v1/messages`. Same port, same prompt, same validator.
- `output_config: { format: { type: "json_schema", schema } , effort: "low" }`, adaptive thinking left on, `cache_control` on the system block (keep the rulebook ≥ 1024 tokens so it actually caches).
- Model default `claude-opus-5`; `claude-haiku-4-5` as the budget option in settings.
- API key in `data.json` with a plaintext warning in the settings tab (no keychain from a plugin).
- Per-session cost counter in the status bar (tokens × price), and a hard daily cap setting.
- Tests: request shape (schema, caching header, no prefill), response parsing, cost accounting.
- **Deliverable:** settings toggle "Analyser: Off / Local (Ollama) / Claude". ~1 session.

### 3.2 — Myth and archetype analysis (on-demand, selection-scoped)

- Different shape from everything above: input is a selection or whole note, output is a **report**, not inline findings.
- Command: "Analyse selection for myth and archetype". Opens a modal (or side panel) with: archetypes detected (hero/mentor/threshold guardian/shadow…), mythic pattern (katabasis, return, sacrifice, trickster…), the evidence quotes, and a one-paragraph note on what the pattern usually asks of the story next.
- Claude only (local 7B models hallucinate Campbell at everything); `effort: "high"`, streaming into the panel.
- Results cached by content hash and stored in the note's frontmatter or a sidecar file, so re-running on an unchanged scene is free.
- Tests: prompt/schema contract; rendering from a fixture report; cache behaviour.
- **Deliverable:** the one feature that genuinely needs a frontier model, scoped so it costs cents per chapter. ~1–2 sessions.

### 3.3 — Evaluation harness (recommended before trusting 3.x in daily use)

- `eval/` folder: 100 hand-labelled sentences (cliché / not, metaphor / not, passive-acceptable / not). Script runs each adapter and reports precision/recall per kind. Tier 1 and Tier 2 rules run through the same harness so you can see what the model adds over the rules.
- ~1 session; pays for itself the first time you change a prompt.

**Tier 3 total: 5–6 sessions.**

---

## Order of execution

```
2.0 async port ──► 2.1 POS tagger ──► 2.2 metaphor candidates ──► (2.3 panel)
                                              │
                                              ▼
                     3.0 Ollama ──► 3.1 Claude ──► 3.3 eval ──► 3.2 myth
```

3.0 depends on 2.0 only; 2.1 and 2.2 can be skipped if you want the LLM path sooner. 3.2 is last because it's the most expensive to iterate on and the least able to be unit-tested.

## Decisions to make before starting Tier 2

1. **Ship `compromise` or stay dependency-free?** It's the only runtime dependency in the whole plan. Pure-JS, 250 KB, actively maintained. I'd take it.
2. **Concreteness norms licence.** Brysbaert's data is CC-BY; the plugin is MIT. Compatible — attribution goes in the README.
3. **Idle analysis default.** Rules run on every keystroke for free. Tagger-backed rules are ~5 ms per paragraph — still fine on keystroke. Model-backed analysis should default to on-command.
