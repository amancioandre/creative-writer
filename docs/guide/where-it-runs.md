# Where it runs

The editor features — typewriter scrolling, current line, focus fade, rhythm, style checks, readability — follow one scope rule. The panels (writing desk, story map, story timeline) are not scoped; they read the whole vault.

## Three modes

Settings → Creative Writer → **Notes**:

| Mode | Runs in |
|---|---|
| **All notes** (default) | Every Markdown note. |
| **Only marked notes** | Notes whose front matter has `creative-writer: true`. |
| **Only these folders** | Notes under the folders listed in **Folders** (one vault-relative path per line, e.g. `Novels/Camp`). |

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

`creative-writer: false` is the right line for memos, research, outlines and review notes that live inside a project folder — it also keeps them out of the [story map](/guide/story-map#what-is-read).

## Commands

- **Toggle Creative Writer (everywhere)** flips the master switch (*Enabled*) for the whole vault.
- **Toggle Creative Writer for this note** writes `creative-writer: true` or `false` into the active note's front matter, depending on whether the plugin is currently active there.
