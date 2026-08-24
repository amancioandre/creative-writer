# Style checks

Tints in the paragraph you are editing, one colour per kind, hover for the note. Everything here runs offline in a few milliseconds: hand-written rules, a part-of-speech tagger ([compromise](https://github.com/spencermountain/compromise)) and a table of word concreteness ([Brysbaert et al.](https://link.springer.com/article/10.3758/s13428-013-0403-5), CC-BY). Nothing is sent anywhere.

Each kind has its own toggle under Settings → **Style checks**, and the whole group has a master toggle.

## What the plugin does *not* check

Spelling, grammar, punctuation, agreement, homophones, and the intensifiers / hedges / filler words ("very", "quite", "just") are deliberately left to [Harper](/reference/harper). **Harper edits the sentence; Creative Writer edits the prose.** Passive voice, filter verbs, nominalisations, clichés, metaphor and rhythm are craft judgements a grammar checker does not make.

## The kinds

### Cliché

~860 curated phrases matched on a word trie — longest match, never across a sentence boundary. Bare idioms that are usually literal ("a dead end", "a crescent moon") and preposition stubs ("nestled in") were removed in an audit; what remains is the tired figurative core. Add your own to the lexicon freely; a hygiene test guards the format.

*Wrong when:* only what is in the list is found. A fresh cliché you coined last year is invisible.

### Passive voice

Modal chain + *be/get* (+ *been/being/getting*) + adverbs or negation + participle; questions ("Was it sent?"); a stative list ("was tired") and a not-a-participle list; names skipped; the agent scan runs to the end of the sentence and excludes "by then". With the tagger, the participle must actually be tagged as one — a plain adjective is accepted only when a *by*-agent follows.

*By design:* "The body was found at dawn" — an agentless passive that is the right choice — is flagged; "was painted red" with no agent reads as a state and is not.

### Filter verb

~70 perception and cognition forms including multi-word ones ("could see", "found herself", "was aware of"). Not inside quotes, not in a noun or passive slot ("a thought", "was decided"), not before a linking preposition ("smelled of"); with the tagger the head must be a verb.

*Wrong when:* "I saw him yesterday" is a report, not a filter, and is flagged.

### Adverb

`-ly` words of five letters or more, minus a non-adverb list ("family", "only") and a stance list ("suddenly", "obviously") that is not the manner adverb the rule is after. Nothing inside quotes; names skipped; a "dialogue tag" note appears only when a quote closed in the same sentence.

*Wrong when:* "sadly" and "clearly" are ambiguous between stance and manner; the stance reading wins and the manner use is missed.

### Repetition

A stemmed content word within 30 words of itself (names skipped; stems handle *-ies*, *-ing* and doubled consonants), or three or more sentences in a row opening the same way — five for the very common openers ("the", "a", "I", "it", "there").

*Wrong when:* deliberate anaphora is flagged at three.

### Nominalisation

*Tagger required.* A light verb plus a noun that hides a verb: "made a decision", "took a look", "gave an explanation" — ~80 mapped pairs, plural via lemma, with a suffix fallback only after *make/take/give/do/conduct/perform/carry/provide/offer/put*. Phrasal forms ("carried out"), indirect objects and adverbs are handled.

*Wrong when:* "take a look" is sometimes the right idiom.

### Weak verb

*Tagger required.* A sentence of fourteen words or more whose only verbs are copulas (*is/was/wasn't/'s*). The finding sits on the main-clause copula, not one after *which/that*.

*Wrong when:* deliberate descriptive stasis.

### Metaphor candidate

*Tagger and concreteness required.* A concrete verb (≥ 3.5) or adjective / material noun (≥ 3.8) applied to an abstract noun (≤ 3.4) with a gap of at least 0.7, looking through auxiliaries, negation and adverbs; plus copula + concrete predicate ("sorrow was a stone"; shell nouns like "the problem was…" excluded). Dead metaphors from a phrase list; open figures ("a flood of …") only when the complement is abstract.

*Wrong when:* verbs the norms rate as abstract ("creep" 3.4) or that are missing ("gnaw") are invisible. Proper nouns, possessives, noun compounds ("office hours") and transaction verbs ("cut the budget") are skipped on purpose. The note is hedged — "possible figurative use" — because this is a candidate, not a verdict.

## Accuracy

On the labelled corpus in `eval/corpus.ts` (100 sentences), the rules alone score micro F1 0.75 and the rules with tagger and norms score **0.97**, with 3 of 36 clean sentences wrongly flagged. Per-rule adversarial audits (~300 sentences each) are pinned as tests. See [Testing & evaluation](/development/testing).

## Rendering

Findings are `Decoration.mark`s with a `data-czm-note`; a hover tooltip reads the note. Because Harper underlines and Creative Writer tints, the two can overlap on the same span and stay readable.
