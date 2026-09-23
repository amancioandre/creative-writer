# Value gauge: design

Status: **built 2026-09-22, all five increments, uncommitted for release (in the Unreleased changelog entry).** Departures: the manuscript's *Gauge marks* toggle is a setting like the page's other toggles rather than a per-project preference, because every manuscript toggle is global and one exception would surprise; the threads chart's toggle is per project as designed. Two stops in one scene that disagree count as *unread* and draw nothing (section 3), rather than the last one counting. The grid's rows are always in manuscript order, so the rule that hides the line when they are not is in the domain and its test but has no view yet. Originally: **designed 2026-09-22.** Explored in Claude Design (project *Creative Writer plugin redesign*, file `Value gauge.dc.html`, also the fourth page of `Plot grid.dc.html`): six boards, a rules strip and a fifteen-point critique (two points added on the revision). The author's decisions of the same day are folded in below and mark the open points closed. Increments in section 8.

## 1. Why

Every scene turns on a value. A love story whose central question is *should jealousy justify violent acts?* moves the reader between hate and love scene by scene, and the story's shape is where that movement reverses. The [plot grid](plot-grid.md) already holds the theme as a column and each scene's cell as a line the writer types; what it cannot show is the direction of that line. The gauge is a thermometer per scene drawn from a word the writer already writes: red pipes to the left of a centreline for a negative value, green to the right for a positive one, and a continuous running total down the same line, so the row where the total changes sign is a reversal the author can see before a reader feels it.

It is a feature of storytelling, not of the grid. It first appears as a column toggled on at the far right of the grid, and the same lines draw a strip under the threads chart and a mark in the manuscript gutter, each with its own toggle.

## 2. Ubiquitous language

| Term | Meaning |
|---|---|
| **Scale** | An ordered, odd-length list of words for one column, from the most negative to the most positive, written as one comment line under the column's heading. The middle word is neutral. Five words is the norm; eleven is the cap. The words name the nuances the theme pivots through, because the point of the scale is the reversal. |
| **Keyword** | The scale word the scene mostly appears to be on this column, written at the front of its stop as `word:`. One per scene per column. Its position on the scale is the scene's **charge**: −2 to +2 on a five-word scale, −5 to +5 on eleven. Independent of the stop's role. |
| **Gauged column** | A column whose heading carries a scale. Themes by default; an arc may carry one too, for what the character feels rather than what the audience should. Any column with a scale line can be gauged. |
| **Lane** | One gauged column drawn as a thermometer. The gauge column shows the main theme's lane by default; the side column's Gauge section ticks more, and lanes beyond three fold into a picker so the view does not clutter. |
| **Running total** | The sum of charges in manuscript order from the first scene, continuous for the whole story, never reset per act. It measures accumulated balance, and is labelled *running total*, never *polarity*. |
| **Inversion** | A row where the running total changes sign. A total that lands exactly on zero keeps its previous sign; an inversion is counted only from strictly positive to strictly negative or back. Marked by a diamond on the centreline, a faint rule across the gauge, and the word *inversion* in the lane. |
| **Marker** | The quoted anchor on a gauged stop: the sentence that carries the value, explicit or implicit. Optional everywhere, and expected on an inversion row: an inversion whose stop has no quote draws its diamond hollow and the Cell section says *no line marks this turn* with the anchor picker. |
| **Disagreement** | A row where two lanes have opposite signs (audience loves, character hates). Signs only: lanes of different lengths do not compare in size. Marked ≠ on the scene column. |

## 3. The data

Nothing new is stored for the gauge itself. The writer writes two things in `Story threads.md`, both readable and hand-editable, and the code counts the rest each time a view draws.

**The scale is one comment line under the heading**, written by *Set scale…* or by hand:

```markdown
## Theme: Should jealousy justify violent acts?
<!-- scale: hate, disgust, indifference, sympathy, love -->
- [[Chapter 1#The customs house]] — sympathy: Tomas carries her trunk up from the quay
- [[Chapter 3#The station]] — disgust: she wipes his kiss off
- [[Chapter 4#Dinner]] — reversal: hate: "his hand found her wrist" he breaks Ilse's wrist

## Arc: [[Anna]]
<!-- scale: hate, fear, calm, trust, love -->
- [[Chapter 4#Dinner]] — fear: says nothing about the wrist
```

**A role and a keyword answer different questions.** A role (`plant:`, `payoff:`, `reversal:`; `want:`, `lie:`, `turn:`, `truth:` under an arc) says what the stop does to the thread. A keyword says what the scene *mostly appears to be* on this column's scale: one word per scene per column, the dominant impression, not a tally of moments inside the scene. They never stand in for each other. A stop may carry either, both, or neither; the gauge reads only the keyword, and most stops carry the keyword alone. `reversal: hate:` is a scene that mostly reads as hate and also happens to be the thread's reversal. Because the role words and the scale words are separate vocabularies (*Set scale…* refuses a scale that reuses a role word), the parser needs no precedence: under a gauged heading any leading `word:` that is a role is the role and any that is on the scale is the keyword, in either order, and anything else stays in the note. The existing parser already leaves an unknown `word:` in the note, so every note written today parses unchanged.

**What the code counts, and never stores:** the charge of each stop, the running total in manuscript order, the inversion rows, and the disagreements between lanes. There is no cache in the vault; a hand edit shows the next time a view draws. Rules the critique settled:

- **Odd and equal.** Positions are integers, so *hate → disgust* is the same distance as *sympathy → love*; an author who feels one end is heavier adds words, and the sheet says the steps are equal. An even-length scale has no neutral word: *Set scale…* cannot save it, and a hand-edited even scale draws nothing and says *scale needs an odd number of words* in the header.
- **Two stops in one scene** that agree, or of which only one carries a keyword, read as that keyword. Two that disagree are not resolved by the code: the row draws nothing, the header counts it as *unread*, and the Cell section names both words so the writer picks one. A scene mostly appears as one thing.
- **Order is manuscript order.** When the grid is sorted or filtered otherwise, the pipes stay and the line hides, and the header says why.
- **Empty is not neutral.** A neutral keyword is a decision and draws a grey tick; an empty cell is nobody's word and draws nothing. Both hold the total flat, so the line is drawn dotted through empty rows.
- **Readings never enter the sum.** The model may offer one scale word as the dashed placeholder of an empty cell, and that is all; only typed words count.
- **Renaming a scale word** would orphan the cells that use it. The sheet lists them and offers the rename as a write the author confirms.
- **A marker goes stale like any anchor.** The quote on a gauged stop is the same anchor the audit already checks, so a rewritten sentence turns a marked inversion into a broken one, drawn with the audit's broken glyph and repaired with the same two keys, `n` then `"`.
- **Three lanes is a starting guess.** The cap before lanes fold into a picker is a constant in the gauge module, to be set after the QA vault has been lived with, not a setting.

**Column layout is a preference,** per project scope in `data.json` under `plotGrid`: whether the gauge column shows, which columns are ticked as lanes, and the threads chart's and manuscript's toggles.

## 4. The views

**The gauge column** is pinned at the right edge of the grid the way Scene and Plot are pinned at the left. Its header shows the scale as a legend, red to green, with the neutral word in grey, and says the line's unit when it has been rescaled (*line: 1 step = 2*). A row draws one pipe per step up to three; from four up the first three merge into one block and singles are added, because separate pipes stop being countable at about four. The neutral word is a single grey tick; the running total is a dot on a thin line; the inversion row carries the diamond, the rule and the label. Colour is never alone: side, count and the word in the cell all carry the sign.

- **Show gauge** in the side column's Gauge section, remembered per project, and a named command. The section lists every scale-bearing column with a checkbox, the main theme ticked by default; more than three ticked folds into a picker.
- **Gauge this column** in a gauged column's ⋯ menu, and **Set scale…**, which opens a sheet in the side column: an ordered word list with the middle word marked neutral, *Add a pair* to keep the count odd, a live preview of the column's twelve-scene lane, the exact comment line it writes, and the helper line *the words name the nuances the theme pivots through; the point is the reversal*. Nothing is written until *Save scale*.
- **The cell editor.** Typing a scale word completes it into a coloured chip with its charge; a word off the scale is allowed and the side column says it is off the scale. A reading's word shows as the placeholder and disappears at the first keystroke; there is no accept key.
- **The state line** counts *11 of 12 scenes charged · inversions at 5 Dinner and 10 The flood*, and *2 lanes · 5 disagreements* when a second lane is on. `n` and `p` already walk readings and broken anchors; an inversion row without a marker joins that walk, because it is a debt of the same kind.

**The threads strip** draws the ticked lanes under the threads chart on the same scene axis, each with its scale as a legend, and is toggled by **Show gauge** in the chart's ⋯ menu, remembered per project, a named command.

**The manuscript gutter** draws a small mark at each scene heading: the pipes at that scene's charge, the keyword under them, and *inversion* on an inversion row. Toggled by **Gauge marks** in the manuscript's ⋯ menu, remembered per project, a named command. The marks read the same lines and never write.

Applied from the plot grid's own rules: a real column in the table with a header the screen reader can name (*Gauge · Audience*); every mark carries its charge as text; the state line is `aria-live`; nothing registers a default hotkey; every menu row names its command so a key can be bound in Settings → Hotkeys.

## 5. The model

Reading a gauged column asks one more thing of the model: the one scale word the scene mostly appears to be, and the sentence that shows it. The reading is validated as every grid reading is (quote located in the prose or dropped), shown as the placeholder and in the Cell section, answered when the writer types, dismissed by `x`. The model never writes the word and never moves the line.

## 6. What the design rejected

- **A reset per act.** Proposed by the critique to stop a long opening run from hiding the turns; declined by the author, because the line is the story's cumulative balance and the reversal is what it is for. The turns are in the pipes.
- **Weighted words** (*hate −3*). They would turn a readable comment into a format. Add words instead.
- **Sentiment from the model.** The word is the writer's. The gauge is a projection of what they typed, not of what a model read.
- **Colour alone.** Side, count and word repeat what red and green say.

## 7. Prototype

- Claude Design: `Value gauge.dc.html` in the project *Creative Writer plugin redesign* (six boards: the grid with the gauge on, anatomy of a row, setting the scale, the cell editor, two lanes, outside the grid; a rules strip; the critique). The same page is the fourth page of `Plot grid.dc.html`. Copies belong in `docs/public/design/` beside the plot grid's files once the revision lands.

## 8. Increments

Each ends in a working, tested, installable plugin, with the vault loop from the plot grid doc, a QA note in obsidian-dev, and the changelog line.

| # | Domain and application | Infrastructure and view | Tests |
|---|---|---|---|
| 0 | `domain/threads/StoryThreadsNote.ts`: the scale line under a heading (`ColumnHeading.scale`), the keyword on a stop, independent of the role, in either order, `formatThreadItem` writing both. `domain/plot/Gauge.ts`: charge, running total (zero holds the sign), inversions, disagreements, the dotted-through-empty rule, disagreeing stops read as unread, odd-length check. | none | Parser fixtures: scale line, role + keyword, keyword alone, a role word in a scale refused, an even scale reported, today's notes unchanged. Gauge cases: the Salt Road twelve with inversions at 5 and 10; zero holds; empty holds; two agreeing stops; two disagreeing stops unread; filtered order hides the line. |
| 1 | `PlotGridSettings`: `gauge` (shown per project, lanes per project). | `PlotGridView`: the pinned gauge column, header legend, pipes and grouped block, tick, line, diamond, rule, label; the Gauge section with *Show gauge* and the lane checkboxes; *Gauge this column* in the column menu; state line counts; commands in `commands.ts`; `styles.css` `.czm-pg-gauge-*`. | View: the column appears on the toggle and survives a reopen; the lane picker past three; the inversion row's marks; the header says why the line is hidden in a sorted grid. |
| 2 | `StoryThreadsNoteRepository`: `putScale`, `renameScaleWord` (line rewrites through the update queue, rename on confirm). | *Set scale…* sheet with preview and the written line; the cell editor's chip and off-scale note; the hollow diamond and *no line marks this turn* with the anchor picker; `n`/`p` extended to unmarked inversions. | Repository: write a scale under an existing heading, replace it, rename a word across three cells and leave the rest. View: type a word, read the chip; Escape leaves the placeholder untyped. |
| 3 | `ColumnAnalyser` read prompt for a gauged column: one scale word and its quote; validation through `validateGridReading`. | The placeholder shows the word; the Cell section shows the quote. | Fixture-driven: the word is on the scale or the reading is dropped; the placeholder never enters the sum. |
| 4 | none | `StoryThreadsView`: the strip under the chart with *Show gauge* in ⋯. `ManuscriptView`: the gutter mark with *Gauge marks* in ⋯. Both remembered per project, both commands. | Each view draws from the same fixture note and hides on its toggle; the marks carry their charge as text. |
