# Files & sync

What the plugin writes, where, and what travels between your machines.

| File | Where | Holds | Syncs with Obsidian Sync? |
|---|---|---|---|
| `data.json` | `.obsidian/plugins/creative-writer/` | Settings, including the story map's filters, colours, display and forces; the Claude key and spend | Only if *Settings → Sync → Installed community plugins* is on. |
| `Creative Writer/Writing log.md` (path in Settings → Goals) | Inside the vault | The writing log: per day, per file, words added and cut — the streaks and the heatmap | **Yes** — a Markdown note. |
| `progress.json` | `.obsidian/plugins/creative-writer/` | The log's old home (before 0.4). Imported into the note once, then left untouched. | No — and no longer needed. |
| `Story map.md` | Inside each project folder | Model readings per scene — relationships, references, events, and (separately, with their own hash) facts — plus the contradictions you dismissed in the threads view and where you pinned nodes by hand | **Yes** — it is a Markdown note, and every sync method carries Markdown. |
| `Story threads.md` | Inside each project folder | The threads you draw by hand: `## heading` per thread, `- [[Note#Heading]] — note` per scene | **Yes** — and it is prose you can edit. |
| `<Name> (manuscript).md` | Inside the project folder, only when you export | A snapshot of the [manuscript](/guide/manuscript) as one note; flagged so it is never read back | **Yes** — a Markdown note; delete it freely. |
| Entity notes, `## Relationships` lines, `story-ignore`, `aliases`, `story-order` | Your notes | Every decision you make in the story map and threads, including nodes, relationships and threads you draw | Yes — they are your notes. |

## The principle

Writer-owned facts go in notes and front matter. Machine-owned facts that cannot be recomputed go in a Markdown note beside the notes they describe. Nothing derived is stored: the story map, timeline and manuscript page are pure functions of the vault, so two machines with the same notes draw the same map — the layout even starts from the same deterministic positions.

## Cross-device caveats

- **The writing log syncs, last-writer-wins.** It is written at most every ten seconds while you write and on unload. If both machines write on the same day *before* syncing, whichever saves last keeps its version of that day; the other machine's words for that day are lost. Writing on one machine at a time — the normal case — is safe, and per-file baselines are re-read when a note opens, so a chapter synced from the other machine is never counted as new words.
- **`Story map.md` conflicts** are rare — it changes when you run a reading, pin a node or dismiss a contradiction — and harmless: the loser's readings are simply re-run on the next *Read project*, because unchanged scenes are recognised by hash, a lost pin is one drag away, and a lost dismissal is one click.
- **`Story threads.md`** is an ordinary note; a conflict there is resolved the way you resolve any note conflict.
- **Map preferences** (colours, forces) follow `data.json`, so they sync only with plugin sync on. They are cosmetic; the story data never depends on them.

## Deleting things

- Delete `Story map.md` → the model layers, the fact threads and the dismissals vanish until you read again; nothing else is affected.
- Delete `Story threads.md` → your hand-drawn threads are gone; names and facts still draw.
- Delete `Writing log.md` → the log starts empty (the old `progress.json`, if any, is imported again); projects still show totals, which come from the vault.
- Reset settings → the log note is untouched; it is a separate file precisely so a settings reset never erases a year of history.
