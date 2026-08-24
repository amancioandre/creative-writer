# Harper companion

[Harper](https://writewithharper.com) is a free, offline grammar and spelling checker with its own Obsidian plugin. Creative Writer is designed to run alongside it, not instead of it.

## The split

**Harper edits the sentence. Creative Writer edits the prose.**

| Harper | Creative Writer |
|---|---|
| Spelling, grammar, punctuation, agreement, homophones | Passive voice, filter verbs, nominalisations, weak verbs |
| Intensifiers, hedges, filler ("very", "quite", "just") — `boring_words`, `filler_words`, `hedging` | Clichés, metaphor candidates, repetition |
| Long sentences (`long_sentences`) | Sentence rhythm, reading-ease bands, dialogue share |
| ~350 more rules | Adverbs of manner (a craft call, not a grammar one) |

Creative Writer once had a "weak words" check for intensifiers and filler; it was removed on purpose because Harper's is better, and having both flag "very" was noise.

## On the page

Both plugins decorate the editor. Harper **underlines**; Creative Writer **tints** the background and sets `text-decoration-color` for rhythm. The marks can sit on the same span and stay readable. Neither plugin knows the other is there; there is nothing to configure.
