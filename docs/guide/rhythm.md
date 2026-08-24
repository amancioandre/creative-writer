# Paragraph rhythm

Every sentence of the paragraph you are in gets an underline whose colour runs cool → warm with the sentence's **effective length**. Short, punchy sentences are blue; long, loaded ones are red. Monotony shows up as a paragraph of one colour before you would hear it reading aloud.

## Effective length

Raw word count is a poor proxy for how long a sentence *feels*. The plugin uses

```
effective length = words + commas + ½ × (polysyllables − expected polysyllables)
```

— a comma adds a beat, and a sentence heavy with three-syllable words reads longer than its word count. Syllables come from a small estimator that is good enough for bucketing (it under-counts vowel hiatus like *po-et*; that never moves a sentence more than one tier).

## Tiers

Settings → **Rhythm tiers** chooses 4, 5 or 6 colour steps. The boundaries between tiers are **absolute**, not relative to the paragraph, so a given colour always means the same length — a paragraph of all-red sentences is genuinely long, not merely longer than its neighbours. Boundaries are tuned for English prose and live in one table (`RhythmScale.withTiers`).

## Sentence splitting

Sentences are split with the platform's `Intl.Segmenter`, then an abbreviation merger rejoins *Mr. Smith*, *St. Ives*, *etc.* and common Portuguese short forms. The colours use `text-decoration-color`, so they never fight Harper's underlines or the style-check tints.

## Only the current paragraph

Rhythm is computed for the cursor's paragraph, on `docChanged`, `selectionSet` and settings changes. Work is bounded by the paragraph, never by the note.
