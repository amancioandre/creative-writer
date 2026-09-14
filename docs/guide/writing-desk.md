# Writing desk & goals

**Open writing desk** (or click the readability label in the status bar) opens a side panel with everything about the work that is not the work itself. Zen Mode hides it with the rest of the chrome.

## Today

Words **added** today against your **Daily word goal** (Settings → Goals; default 500), as a bar; words **cut** today shown separately. Deletions are tracked on their own so a revision day still counts as work: when cutting outweighs adding, the desk says *Revision day* and the streak counts it when the goal is 0.

Below: current streak, best streak, this week's total.

## Heatmap

Twelve weeks, one cell per day, shaded by words added *or* cut (busiest day sets the scale). The key under the grid says the rest: an outlined cell met the goal, a hollow cell was mostly cutting. Hover a cell for the exact numbers. Under the readability bands sits the editor's own key: the rhythm tiers from short to long, and the tint of each style check.

## How words are counted

The plugin watches every open note that is [in scope](/guide/where-it-runs) — the story, not the side material. When a note opens, its word count is the **baseline**; each edit, after an 800 ms pause, records the delta against the last count as added or removed for that file and that day. Renames follow the file; deletes forget it. The log is saved at most every ten seconds and flushed on unload.

This means:

- pasting a chapter in counts as adding it; deleting one counts as cutting it;
- a note edited outside Obsidian is re-baselined the next time it opens, so nothing is counted twice;
- the log is per file, so [projects](/guide/projects) can sum only their own folder;
- the desk reads the log through the scope, so changing *Where it runs* re-derives the totals and the streak without touching the log.

## Echoes

When the active note is in a project, the phrases the [echo finder](/guide/story-threads#echoes) hears across that project, ten at most: the phrase, how many times, how many scenes, how close its nearest two occurrences are, and whether it is a *habit* (spread over three scenes or more), a *tic* (heard within a couple of scenes) or just an echo. Habits come first. Click one to open the first place it occurs. The list is read from the project at most every twenty seconds; the story threads view draws the same pairs and is where a motif is kept.

## Readability of the note

The active note's word, sentence and paragraph counts, then its reading-ease, sentence-rhythm and dialogue bands with hints — see [Readability](/guide/readability) for the bands.

## Scenes

The note's headings, each with its word count (bar-scaled to the longest scene), reading-ease band and dialogue share. Click a scene to put the cursor on its heading. Only headings with prose under them are scenes; an outline of bullet points is structure, not story.

## Projects

Each project declared in front matter with its total, target, percentage, pace line and — if it has a daily goal — today's words and its own streak. See [Projects](/guide/projects).

## Where the log lives

In a note — `Creative Writer/Writing log.md` by default; change the path under Settings → Goals → *Writing log note* — so it syncs with the vault and your streak is the same on every machine. The note is flagged `creative-writer: false` so the plugin never counts it, and edits to it are never logged. A log from an earlier version (`progress.json` in the plugin folder) is imported the first time the note is missing. See [Files & sync](/reference/data-and-sync).
