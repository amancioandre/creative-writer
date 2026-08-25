# Where it runs

Creative Writer supports writing the story — not the journal, the meeting notes or the research beside it. One scope rule decides which notes are *the story*, and every feature follows it:

- the editor features — typewriter scrolling, current line, focus fade, rhythm, style checks, readability — run only there;
- the [writing desk](/guide/writing-desk) counts words added and cut only there, for the daily goal, the streak and the heatmap;
- [project](/guide/projects) totals and per-project daily goals count only notes that are both in the project folder and in scope;
- the [story map](/guide/story-map), timeline and threads read only notes in scope.

The plugin's own notes — the writing log, `Story map.md`, `Story threads.md` — are never counted or read, whatever the mode.

## A project is the story

A declared [project](/guide/projects) — a folder (or single note) with `writing-target` or `story: true` in a note's front matter — is always in scope, whatever the mode below, minus the notes you opt out. That is what makes the story map, the threads and the project totals work without further configuration: declaring the project is the marking.

## Four modes

Settings → Creative Writer → **Notes** decides what is in *besides* the projects. The setting shows how many of the vault's notes the current rule takes in.

| Mode | Runs in |
|---|---|
| **Project folders only** | Nothing outside the projects. The scope grows as you declare projects; the journal, the meeting notes and the research beside them never count. |
| **… and every other note** (default) | Every Markdown note. Good for a vault that *is* the writing. |
| **… and these folders** | Also the folders listed in **Folders** (one vault-relative path per line, e.g. `Drafts/Shorts`). |
| **… and marked notes** | Also notes whose front matter has `creative-writer: true`. |

## The note always wins

A note's own front matter overrides the mode:

```yaml
---
creative-writer: true    # run here even if the mode would skip it
---
```

```yaml
---
creative-writer: false   # never run here, whatever the mode
---
```

`creative-writer: false` is the right line for memos, research, outlines and review notes that live inside a project folder: their words are not counted toward the daily goal or the project target, and the [story map](/guide/story-map#what-is-read) does not read them.

## Changing the scope later

The writing log records every note it was shown; the desk reads it *through* the scope. Narrow the scope and the old journal entries drop out of your totals and streak; widen it and they come back. Nothing is rewritten.

## Commands

- **Toggle Creative Writer (everywhere)** flips the master switch (*Enabled*) for the whole vault.
- **Toggle Creative Writer for this note** writes `creative-writer: true` or `false` into the active note's front matter, depending on whether the plugin is currently active there.
