# Paragraph rhythm

Every sentence of the paragraph you are in sits on a faint tint whose colour runs cool → warm with the sentence's **effective length**. Short, punchy sentences are blue; long, loaded ones are red. Monotony shows up as a paragraph of one colour before you would hear it reading aloud.

The tint is deliberately quiet, a wash behind the words rather than a line under them. Underlines are already taken: Obsidian's spellcheck, [Harper](https://writewithharper.com) and links all draw them, and a sentence that carried all three plus a rhythm rule was unreadable. Style checks tint too, at a stronger alpha, so a cliché inside a long sentence reads as the darker patch on the warmer ground.

## In Zen Mode

Zen Mode keeps the page plain. Rhythm leaves the text and moves to the margin: one bar per sentence, stacked down from the top of the paragraph you are in, all starting at the same x and growing towards the text with the sentence's tier. The meter reads as the paragraph's shape at a glance, and the words carry no colour at all. Turn rhythm off and the meter goes with it.

## Effective length

Raw word count is a poor proxy for how long a sentence *feels*. The plugin uses

```
effective length = words + commas + ½ × (polysyllables − expected polysyllables)
```

— a comma adds a beat, and a sentence heavy with three-syllable words reads longer than its word count. Syllables come from a small estimator that is good enough for bucketing (it under-counts vowel hiatus like *po-et*; that never moves a sentence more than one tier).

## Tiers

Settings → **Rhythm tiers** chooses 4, 5 or 6 colour steps. The boundaries between tiers are **absolute**, not relative to the paragraph, so a given colour always means the same length — a paragraph of all-red sentences is genuinely long, not merely longer than its neighbours. Boundaries are tuned for English prose and live in one table (`RhythmScale.withTiers`).

## Sentence splitting

Sentences are split with the platform's `Intl.Segmenter`, then an abbreviation merger rejoins *Mr. Smith*, *St. Ives*, *etc.* and common Portuguese short forms.

## Only the current paragraph

Rhythm is computed for the cursor's paragraph, on `docChanged`, `selectionSet` and settings changes, once for both renderings. Work is bounded by the paragraph, never by the note.
