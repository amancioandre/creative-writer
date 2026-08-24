# Files & sync

What the plugin writes, where, and what travels between your machines.

| File | Where | Holds | Syncs with Obsidian Sync? |
|---|---|---|---|
| `data.json` | `.obsidian/plugins/creative-writer/` | Settings, including the story map's filters, colours, display and forces; the Claude key and spend | Only if *Settings → Sync → Installed community plugins* is on. |
| `Creative Writer/Writing log.md` (path in Settings → Goals) | Inside the vault | The writing log: per day, per file, words added and cut — the streaks and the heatmap | **Yes** — a Markdown note. |
| `progress.json` | `.obsidian/plugins/creative-writer/` | The log's old home (before 0.4). Imported into the note once, then left untouched. | No — and no longer needed. |
| `Story map.md` | Inside each project folder | Model readings per scene: relationships, references, events, with a hash of the prose read | **Yes** — it is a Markdown note, and every sync method carries Markdown. |
| Entity notes, `story-ignore`, `aliases` | Your notes | Every decision you make in the story map | Yes — they are your notes. |

## The principle

Writer-owned facts go in notes and front matter. Machine-owned facts that cannot be recomputed go in a Markdown note beside the notes they describe. Nothing derived is stored: the story map and timeline are pure functions of the vault, so two machines with the same notes draw the same map — the layout even starts from the same deterministic positions.

## Cross-device caveats

- **The writing log syncs, last-writer-wins.** It is written at most every ten seconds while you write and on unload. If both machines write on the same day *before* syncing, whichever saves last keeps its version of that day; the other machine's words for that day are lost. Writing on one machine at a time — the normal case — is safe, and per-file baselines are re-read when a note opens, so a chapter synced from the other machine is never counted as new words.
- **`Story map.md` conflicts** are rare — it changes only when you run a reading — and harmless: the loser's readings are simply re-run on the next *Read project*, because unchanged scenes are recognised by hash.
- **Map preferences** (colours, forces) follow `data.json`, so they sync only with plugin sync on. They are cosmetic; the story data never depends on them.

## Deleting things

- Delete `Story map.md` → the model layers vanish until you read again; nothing else is affected.
- Delete `Writing log.md` → the log starts empty (the old `progress.json`, if any, is imported again); projects still show totals, which come from the vault.
- Reset settings → the log note is untouched; it is a separate file precisely so a settings reset never erases a year of history.
