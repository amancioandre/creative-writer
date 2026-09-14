# Lenses

A lens is a reading pass. It colours every open note one way at a time, so a tint always means one thing: under the **style checks** lens a tint is a cliché, a passive, a filter verb; under the **words** lens it is one of your own overused words, coloured by category. One lens is on across the vault and is kept between sessions. Switching one on switches the other off.

The idea comes from the way Maxwell Alexander Drake revises: a dialogue pass, then an accent pass, then a bad-words pass, each with its own highlight, never all at once. Five highlights on one page cannot be read; one at a time can.

What is not a lens stays under every lens: focus fade, the current line, typewriter scrolling, the rhythm meter in Zen Mode, and Harper's underlines. The faint sentence tint of [paragraph rhythm](/guide/rhythm) stays too unless you switch **Rhythm tint underneath** off under Settings → Lenses. Zen Mode shows no lens at all: the page is plain there.

## Switching

- The status bar shows the lens on the right, *Lens: words*, or *No lens*. Click it for the next one.
- Every lens is a command, and every lens command starts with **Lens:**, so typing `lens` in the palette lists them all: **Lens: style checks**, **Lens: words**, **Lens: next**, **Lens: off**. A lens command toggles its lens: on when another or none is on, off when it is the one on.
- None ships with a hotkey, as with every command in this plugin; bind your own in Settings → Hotkeys, where the prefix keeps them together.
- Settings → Lenses → **Lens** is the same switch as a dropdown.

## Style checks

The offline [style checks](/guide/style-checks), one colour per kind, in the paragraph you are editing. Which kinds show is the row of chips under the lens.

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
