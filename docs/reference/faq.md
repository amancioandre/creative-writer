# FAQ & troubleshooting

## Editor

**Nothing is tinted or faded in my note.**
Check *Enabled* in settings, the *Notes* mode ([Where it runs](/guide/where-it-runs)), and the note's own `creative-writer:` line. Reading view has no editor; switch to Live Preview or Source.

**A paragraph has no rhythm underlines.**
Rhythm only colours the paragraph the cursor is in.

**A finding is wrong.**
Each rule's known misses are listed in [Style checks](/guide/style-checks). Anything not listed there is a bug worth an issue with the sentence.

**Harper and Creative Writer both mark the same word.**
By design where they overlap; if it is an intensifier or filler word, Creative Writer should not be marking it — that was removed. See [Harper companion](/reference/harper).

## Writing desk

**Today's words are wrong after I pasted a chapter in.**
Pasting counts as adding. Cutting counts as cutting. That is the model: the log measures the file's size over time, not keystrokes.

**My streak differs on the laptop.**
The log is a note (`Creative Writer/Writing log.md`) and syncs with the vault; give the sync a moment, and avoid writing on both machines on the same day before they have synced — see [Files & sync](/reference/data-and-sync).

## Story map

**The map is empty.**
There is no project (no note with `writing-target`), or the project has no typed notes and no name recurs three times yet. See [Structuring a project](/guide/story-projects).

**"He", "If" or another non-name shows up as an unnamed node.**
It should not — pronouns, modals and verbs are vetoed. If one gets through, click it → *Not a name*; it is written to `story-ignore` and never returns. An issue with the sentence it came from helps make the veto better.

**The map shows my memos, review notes and outlines as chapters.**
Add `creative-writer: false` to their front matter. Everything else in the folder is story.

**A character is not found although she has a note.**
Her note must be typed (`type: character` or a `Characters/` folder). If the prose uses a different name, add it to her `aliases`. Ambiguous surnames (two Kovácses) do not resolve on purpose.

**Edges are dashed.**
The scene changed since the model read it. Re-read the note (or the project — unchanged scenes are skipped).

**Read project with model says it needs a local model.**
Settings → Model assistant → Model → Local (Ollama). The story reading and the myth report are local-only.

**The layout is a blob / too spread out.**
Panel → Forces. Raise repulsion or link distance to spread; raise centre pull to gather. *Shake* re-settles; *Fit* frames.

**Two machines show different maps.**
They should not, given the same notes. Check that the project folder — including `Story map.md` and the entity notes — has actually synced, and that neither machine has an extra memo without `creative-writer: false`.

## Models

**Ollama: connection refused.**
Ollama is not running, or the URL is wrong. `ollama serve`, then check `http://localhost:11434` in a browser.

**The model finds something in every sentence.**
Small models cannot abstain; that is measured and is why the model is asked only about judgement kinds, on command. Prefer a 14B model, or leave the offline rules to do the work.

**Claude costs money.**
Yes. *Daily spending cap* stops calls when reached; the status bar shows the session's cost. The key is stored in plain text in `data.json`.
