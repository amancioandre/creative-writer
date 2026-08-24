# Eval results — 2026-08-23

Corpus: `eval/corpus.ts`, 100 labelled sentences (64 with at least one expected kind, 36 clean). The former `weak` kind (intensifiers, hedges, filler) was dropped on 2026-08-24 — that is Harper's job — and its 10 sentences with it; the figures below predate that and are unchanged for the remaining kinds (verified by re-running `npm run eval`). The same day, a rule audit (~300 adversarial sentences per rule, pinned in `tests/domain/style/audit.test.ts`) rewrote the passive, adverb, filter, repetition, nominalisation and metaphor rules; the corpus score is unchanged, the corpus simply never contained the failure modes (negated passives, names as echoes, noun compounds as metaphors, literal "a flood of water"). Scoring is sentence-level per kind. Run: `npm run eval` (rules), `npm run eval:ollama` (local model).

## Rules (Tier 1 + 2)

| | micro P | micro R | micro F1 | clean flagged |
|---|---|---|---|---|
| Tier 1 (rules only) | 0.85 | 0.67 | 0.75 | 4 / 36 |
| Tier 2 (+ tagger + norms) | **0.96** | **0.97** | **0.97** | 3 / 36 |

Remaining misses are by design: agentless passives that are correct ("The body was found at dawn"), "watched the tide go out" as a filter verb, and metaphor verbs the norms rate as abstract ("gnaw" is not in the frequent-lemma set).

## Local models (Ollama), judgement kinds only (cliche, metaphor, passive)

| model | mode | micro P | micro R | micro F1 | clean flagged |
|---|---|---|---|---|---|
| qwen2.5:7b | 8 sentences per call | 0.29 | 0.25 | 0.27 | 20 / 36 |
| qwen2.5:7b | 1 sentence per call | 0.22 | 0.63 | 0.33 | 31 / 36 |
| deepseek-r1:14b | 8 sentences per call | 0.48 | 0.42 | 0.45 | 0 / 36 |

**Reading:** at 7B the model cannot abstain — given a sentence it finds something — and an explicit "most sentences are fine" rule did not change that. deepseek-r1:14b abstains correctly (0 clean false alarms) but is slow (reasoning tokens) and still well below the rules on recall. Neither local model is accurate enough to run on idle; the default stays **on-command**, and the rules own every mechanical check. Where a local model adds value is the *note text* on spans the rules already found, and contextual calls the rules cannot make — and it should be presented as a second opinion, not a verdict.

Claude (Opus 5 / Haiku 4.5) was not measured: no API key on the build machine. The harness runs it with `ANTHROPIC_API_KEY=… npx vitest run tests/eval/model`.
