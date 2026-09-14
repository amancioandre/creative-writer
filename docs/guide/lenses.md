# Lenses

A lens is a reading pass. It colours every open note one way at a time, so a tint always means one thing: under the **style checks** lens a tint is a cliché, a passive, a filter verb; under the **dialogue** lens it is speech or thought; under the **words** lens it is one of your own overused words, coloured by category; under the **accents** lens it is a word a character uses or never says. One lens is on across the vault and is kept between sessions. Switching one on switches the other off.

The idea comes from the way Maxwell Alexander Drake revises: a dialogue pass, then an accent pass, then a bad-words pass, each with its own highlight, never all at once. Five highlights on one page cannot be read; one at a time can.

What is not a lens stays under every lens: focus fade, the current line, typewriter scrolling, the rhythm meter in Zen Mode, and Harper's underlines. The faint sentence tint of [paragraph rhythm](/guide/rhythm) stays too unless you switch **Rhythm tint underneath** off under Settings → Lenses. Zen Mode shows no lens at all: the page is plain there.

## Switching

- The status bar shows the lens on the right, *Lens: words*, or *No lens*. Click it for the next one.
- Every lens is a command, and every lens command starts with **Lens:**, so typing `lens` in the palette lists them all: **Lens: style checks**, **Lens: dialogue**, **Lens: words**, **Lens: accents**, **Lens: next**, **Lens: off**. A lens command toggles its lens: on when another or none is on, off when it is the one on.
- None ships with a hotkey, as with every command in this plugin; bind your own in Settings → Hotkeys, where the prefix keeps them together.
- Settings → Lenses → **Lens** is the same switch as a dropdown.

## Style checks

The offline [style checks](/guide/style-checks), one colour per kind, in the paragraph you are editing. Which kinds show is the row of chips under the lens.

## Dialogue

Speech at full tint, thought at half, narration dimmed, so you can read only the talk and ask Drake's question: does the dialogue carry the scene without the narration? If it does, the narration is making a scene that already works better; if it does not, the scene leans on narration to happen.

How speech and thought are written is a convention, so it is a setting, and a project can override it in its [project note](/reference/front-matter#project-note):

| | Settings → Lenses | Project note |
|---|---|---|
| Speech | **Dialogue marks**: double quotes “ ”, single quotes ‘ ’, dash lines (the travessão: a paragraph that opens with — is speech, and each further — toggles narration and speech), or none. | `dialogue: double` · `single` · `dash` · `none` |
| Thought | **Thought marks**: a whole paragraph in italics (the default), any italics, single quotes, a custom pattern, or none. | `thoughts: italic-paragraph` · `italic-any` · `single-quotes` · `none`, or a regular expression of your own |

Under the default, italics inside a sentence are emphasis and never a thought: `_Alone_ was generous` stays narration; `_He is guessing. He has to be guessing._` on a line of its own is a thought. A custom pattern is tested against each paragraph; every match is a thought, or its first group when the pattern has one. **Dim narration** fades everything that is not speech or thought; switch it off to keep the page at full strength with the tints on top.

### Who is speaking

With a cast, each paragraph of speech is tinted in its speaker's colour, and the hover says who and how that was decided. The cast is the project's character notes (a `type: character` or a `Characters/` folder, as for the [story map](/guide/story-map)), their names and `aliases`, plus character notes outside every project, a shared cast folder say. A note's `colour: "#c8773a"` is its speaker colour; the rest take one from a palette of eight in cast order. A project note can narrow and order the cast with `speakers: [Mara, Tomas #c8773a]`, names with no note included, a colour pinned with `#hex`.

Attribution is a guess, and it says how good a guess:

- **dialogue tag**: a name next to a speech verb in the paragraph, *“Yes, well,” Tomas said.*
- **named in the paragraph**: the one character named outside the quotes, *“You came alone?” Tomas did not look up.*
- **turn-taking**: the voice before the last one in a two-voice exchange, or, when only one voice has spoken, the one other character named in the scene. A thought is given to the one listening and does not take a turn.
- **speaker not found**: grey. No tag, no name, no clean turn; more than two narration paragraphs since the last line, or a heading or scene break, starts the exchange over.

A grey line is a question, not an error: add a tag, or leave it. Switch **Speaker colours** off for one colour and no attribution.

The dialogue lens hides the rhythm tint whatever the *Rhythm tint underneath* setting says: a colour here means one thing.

## Accents

Drake writes accents and wants them consistent: a Roarthian never says *my*, *yes*, *no*, *will*, *into*. The accents lens shows the dialogue page at a faint tint by speaker and, inside each speaker's own lines, the words their character note says they **use** (green) and the words they **never say** (red). Never in narration, never in a line nobody is pinned to: a grey line under the dialogue lens gets no accent marks here. Hover a word for whose accent it is.

The lists live in the character note:

```yaml
aliases: [the Roarthian]
colour: "#c8773a"
accent: [aye, yer, ye'll, nay]
accent-never: [my, yes, no, will, into]
```

Words or phrases, a list or a comma string, matched whole and case-insensitively. A character with neither key gets no marks. Attribution is the dialogue lens's, so a wrong guess there is a wrong mark here; add a tag and both follow.

## Words

Your own overused words, tinted wherever they occur in the visible part of the note, one colour per category. Hover a tint for the category and how many times the word occurs in the note.

The list is a note, so it syncs with the vault and you edit it like anything else. Settings → Lenses → **Bad words note** names it, `Creative Writer/Bad words.md` by default. One heading per category, the words and phrases under it, separated by commas or lines, bullets or not:

```markdown
## Filtering
felt, saw, heard, noticed, realised

## Redundant motions
colour: #63b3ed
turned, shifted, moved, engaged

## Stage direction
then, and then, before
```

Matching is by whole word or phrase, case-insensitive, never across a sentence boundary. Colours follow heading order from a palette of eight; a `colour: #hex` line under a heading pins that category's colour. Save the note and the page follows.

A project can keep its own list: `bad-words: [[Bad words]]` in the [project note](/reference/front-matter#project-note), a link or a path. Notes inside that project use it instead of the vault-wide note.

What goes on the list is yours. The built-in style checks are the same mechanism with fixed lists: filter verbs, adverbs and the rest. Generic filler words ("very", "just", "quite") are [Harper's](/reference/harper) and are not shipped here; if they are your habit, they are one heading away.
