# Projects

A project is a folder with a target. Declare it in the front matter of any note in that folder:

```yaml
---
writing-target: 80000          # words; this line makes the folder a project
writing-deadline: 2026-12-31   # optional
writing-daily: 500             # optional: words per day on this project, with its own streak (writing-goal is read as the same)
writing-name: The Bear Hunt    # optional: overrides the folder name
writing-scope: note            # optional: count only this note, not the folder
story-ignore: [LOW, POV]       # optional: names the story map must not take for characters
---
```

A project with no target is a folder you want to *map* but not *pace* — the novel you are reading and taking apart, or a story you are sketching before a word of it exists. Declare it with one line instead:

```yaml
---
story: true                    # a project for the story map and timeline; the writing desk leaves it alone
---
```

The note that carries these lines is the **project note**. It can be the manuscript itself (a short story with one heading per scene), an outline, or an otherwise empty `My Novel.md` — the plugin only reads its front matter, and writes back to it when you tell the story map that a name is [not a name](/guide/story-map#candidates).

## What is counted

Every Markdown note whose path starts with the folder (or, with `writing-scope: note`, only the project note) **and** that is [in scope](/guide/where-it-runs). Totals come from the vault, not the writing log, so a chapter you wrote before installing the plugin counts. Memos inside the folder do not count once they carry `creative-writer: false` — the same line that keeps them out of the story map; see [Structuring a project](/guide/story-projects). `Story map.md` and `Story threads.md` never count.

## The pace line

In the writing desk, each project shows total / target, a bar, and one sentence:

| Verdict | When | Says |
|---|---|---|
| **Done** | total ≥ target | Target reached. |
| **Stalled** | nothing added in the last 7 days | Nothing added this week, plus the daily rate that would still make the deadline. |
| **No deadline** | no `writing-deadline` | Your last-7-day rate and the projected finish date. |
| **On track** | projected finish ≤ deadline | Words a day needed vs. writing, projected finish, deadline. |
| **Behind** | projected finish > deadline (or deadline passed) | Same numbers, with the gap spelled out. |

"Writing N a day" is the average over the last seven days from the writing log, so a fortnight of silence shows as stalled rather than as a very late finish date.

With `writing-daily`, the project also gets *Today N of M* with its own streak, independent of the vault-wide daily goal.

## Several projects

Any number of folders can be projects; a note can even declare one on a single file with `writing-scope: note`. The story map and timeline pick the project of the active note (the narrowest folder that contains it) and let you switch from a dropdown.
