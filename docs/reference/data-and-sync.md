# Files & sync

What the plugin writes, where, and what travels between your machines.

| File | Where | Holds | Syncs with Obsidian Sync? |
|---|---|---|---|
| `data.json` | `.obsidian/plugins/creative-writer/` | Settings, including the story map's filters, colours, display and forces; the Claude key and spend | Only if *Settings → Sync → Installed community plugins* is on. |
| `progress.json` | `.obsidian/plugins/creative-writer/` | The writing log: per day, per file, words added and cut | **No.** Obsidian Sync carries only `main.js`, `manifest.json`, `styles.css` and `data.json` for a plugin. |
| `Story map.md` | Inside each project folder | Model readings per scene: relationships, references, events, with a hash of the prose read | **Yes** — it is a Markdown note, and every sync method carries Markdown. |
| Entity notes, `story-ignore`, `aliases` | Your notes | Every decision you make in the story map | Yes — they are your notes. |

## The principle

Writer-owned facts go in notes and front matter. Machine-owned facts that cannot be recomputed go in a Markdown note beside the notes they describe. Nothing derived is stored: the story map and timeline are pure functions of the vault, so two machines with the same notes draw the same map — the layout even starts from the same deterministic positions.

## Cross-device caveats

- **The writing log does not sync.** Streaks and the heatmap are per machine. If you write on two machines, each has its own history. (Moving the log into the vault is possible; the trade-off is that Obsidian Sync resolves a same-day conflict last-writer-wins.)
- **`Story map.md` conflicts** are rare — it changes only when you run a reading — and harmless: the loser's readings are simply re-run on the next *Read project*, because unchanged scenes are recognised by hash.
- **Map preferences** (colours, forces) follow `data.json`, so they sync only with plugin sync on. They are cosmetic; the story data never depends on them.

## Deleting things

- Delete `Story map.md` → the model layers vanish until you read again; nothing else is affected.
- Delete `progress.json` → the writing log starts empty; projects still show totals (those come from the vault).
- Reset settings → `progress.json` is untouched; it is a separate file precisely so a settings reset never erases a year of history.
