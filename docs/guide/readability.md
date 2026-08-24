# Readability

## In the status bar

With **Readability in status bar** on, the status bar shows two words for the paragraph you are in: its reading-ease band and its sentence-rhythm band. Hover for the hint; click to open the [writing desk](/guide/writing-desk) with the whole note's profile.

## The bands

Reading ease is Flesch, with Wikipedia's bands and hints rewritten for fiction rather than technical prose:

| Score | Band | Hint |
|---|---|---|
| ≥ 90 | Very easy | Reads like a children's book. Fine for pace; check it isn't thin. |
| ≥ 80 | Easy | Conversational. Most commercial fiction sits here. |
| ≥ 70 | Fairly easy | Clear and quick. A comfortable default for narrative. |
| ≥ 60 | Plain | Plain English. Literary fiction often lands here. |
| ≥ 50 | Fairly dense | Longer sentences or heavier words. Deliberate? Keep it. |
| ≥ 30 | Dense | Demanding. Readers will slow down — make sure that's the point. |
| < 30 | Very dense | Hard to follow. Split sentences or swap Latinate words for short ones. |

Sentence rhythm is the coefficient of variation of sentence length (needs at least three sentences):

| CV | Band | Hint |
|---|---|---|
| < 0.30 | Monotone | Sentences are all about the same length. Break one short, let one run. |
| < 0.55 | Steady | Even rhythm. Good for calm passages; tension usually wants more contrast. |
| < 0.80 | Varied | Healthy mix of short and long. This is where most strong prose sits. |
| ≥ 0.80 | Dynamic | Big swings between short and long. Powerful in action; check it isn't choppy. |

Dialogue share is the fraction of words inside straight or curly double quotes:

| Share | Band | Hint |
|---|---|---|
| < 15 % | Narration-led | Little dialogue. Fine for interiority or description; scenes may feel told. |
| < 45 % | Balanced | Dialogue and narration share the page. |
| ≥ 45 % | Dialogue-led | Mostly talk. Fast to read; make sure the setting and bodies don't vanish. |

The desk also shows the grade level and the raw numbers (Flesch score, sentence count, variation %).

## What counts as prose

Headings, list items, block-quote markers, tables, code fences, front matter and inline markup are stripped before measuring — they are not the writer's sentences and would skew every number. The same `proseParagraphs` pass feeds the scene outline and the story map.
