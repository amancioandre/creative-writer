# Creative Writer — Zen Mode, typewriter scrolling and story tools for fiction in Obsidian

[![Downloads](https://img.shields.io/badge/dynamic/json?label=downloads&query=%24%5B%22creative-writer%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json&color=573E7A)](https://obsidian.md/plugins?id=creative-writer)
[![Latest release](https://img.shields.io/github/v/release/amancioandre/creative-writer?color=573E7A)](https://github.com/amancioandre/creative-writer/releases/latest)
[![Support](https://img.shields.io/badge/%E2%9D%A4-Support%20the%20plugin-ff69b4)](#support)
[![Docs](https://img.shields.io/badge/docs-amancioandre.github.io-blue)](https://amancioandre.github.io/creative-writer/)

**Write novels, short stories and screenplays in Obsidian with nothing between you and the sentence.** A distraction-free zen mode, typewriter scrolling, focus fade, sentence rhythm, offline prose style checks, daily word-count goals, and a story map of your characters and places — all built from your own notes, all offline.

![Zen Mode with typewriter scrolling and focus fade](docs/public/media/hero.gif)
<!-- TODO record: toggle Zen Mode, type two sentences; 8 s loop, ≤ 800 px wide -->

Everything that touches the page lives in the editor. Everything *about* the work — progress, readability, the cast, the shape of the story — lives in panels that Zen Mode hides.

**[▶ Watch the 3-minute walkthrough](https://www.youtube.com/watch?v=VIDEO_ID)**
<!-- TODO: replace with [![Watch](docs/public/media/youtube-thumb.jpg)](https://youtu.be/VIDEO_ID) once the unlisted video is up -->

## Who it's for

- Novelists and short-fiction writers who want Obsidian to feel like a focused writing app — without moving the manuscript out of the vault.
- Anyone tracking a draft against a deadline: NaNoWriMo, a 90,000-word target, a chapter a week.
- Writers who want a **local**, on-command reader for craft feedback, not a cloud AI rewriting their prose.

## Features

### Zen Mode, typewriter scrolling, focus fade

One command hides the ribbon, tabs, sidebars and status bar (optionally fullscreen). Typewriter scrolling keeps the line you're writing centred; focus fade veils the rest of its paragraph slightly and farther paragraphs progressively by distance. A faint band marks the current line.

`Toggle Zen Mode` · Settings → Typewriter scrolling / Focus fade / Current line

### Paragraph rhythm and offline style checks

![Sentence rhythm underlines and style tints](docs/public/media/rhythm.gif)
<!-- TODO record: type a long sentence and watch underlines warm -->

Each sentence of the current paragraph is underlined cool → warm by its felt length, so you *see* monotony before you hear it. Style checks tint clichés, passive voice, filter verbs, adverbs, repetition, nominalisations, weak verbs and metaphor candidates; hover for the note. Rules, a part-of-speech tagger and concreteness norms — no network, no model required.

Settings → Paragraph rhythm / Style checks (every kind toggles individually)

### Story map

![Story map graph of characters, places and scenes](docs/public/media/story-map.gif)
<!-- TODO record: open map, drag a node, click a card -->

One graph of a project. Characters, places and things are nodes (typed notes — `type: character` in front matter or a `Characters/` folder — plus recurring unnamed names as *candidates* you can turn into notes with one click). Three layers of edges: **links** you wrote, **scenes** shared, and **references** a local model reads between the lines. Pan, zoom, drag, pin, search, tune the forces. Rebuilt from your notes every time; only model readings persist, in a `Story map.md` inside the project so it syncs with the manuscript.

`Open story map` or the ribbon icon

### Story timeline

![Story timeline: scenes down the side, cast across the top](docs/public/media/timeline.png)

Every scene in reading order down the side, the cast across the top, a dot where someone is present. The shape a story's absences make. Click a scene to jump, a name to open the note.

`Open story timeline`

### Writing desk: goals, streaks, readability, scenes

![Writing desk with daily goal, heatmap and project targets](docs/public/media/desk.png)

Words added *and cut* today against a daily goal, a streak, this week's total and a 12-week heatmap — revision days count as work. Add `writing-target: 50000` (and `writing-deadline: 2026-10-31`) to any note and its folder becomes a project with words-per-day needed vs. your last-7-day pace and a projected finish date. The desk also shows the note's reading ease, grade level, sentence rhythm and dialogue share, and a clickable scene outline. History lives in a vault note so it syncs between machines.

`Open writing desk` · click the readability band in the status bar

### Local model assistant — optional, on command, never by default

![Myth and archetype report](docs/public/media/myth.png)

If [Ollama](https://ollama.com) is running on your machine, the plugin can read a paragraph for contextual findings (clichés in context, tired metaphors, passives hiding an agent), a selection for mythic patterns and archetypes, or a chapter for relationships and references. Nothing leaves your computer, and nothing runs unless you ask. The offline rules beat a local 7B at every mechanical check ([eval results](eval/RESULTS.md)), which is why the model is a second opinion, not the default.

`Analyse paragraph with model` · `Analyse selection for myth and archetype`

### Where it runs

Declared projects are always in. Beyond that, choose: every note, listed folders, notes marked `creative-writer: true`, or nothing. A note's own front matter always wins. Two commands toggle the plugin everywhere or for the current note.

## Install

**Community plugins:** Settings → Community plugins → Browse → search **Creative Writer** → Install, Enable.

**Beta via [BRAT](https://github.com/TfTHacker/obsidian42-brat):** add `amancioandre/creative-writer`.

Desktop only; editing mode (Source and Live Preview). Reading view is untouched.

## Pair it with Harper

![Harper and Creative Writer marking the same paragraph](docs/public/media/harper.png)

Install [Harper](https://writewithharper.com) alongside — it is the intended companion. Harper is a free, offline grammar and spelling checker; Creative Writer deliberately leaves spelling, grammar, punctuation and filler words to it. **Harper edits the sentence, Creative Writer edits the prose.** Their marks overlap cleanly: Harper underlines, Creative Writer tints.

## Privacy

No network requests. The only exception is the optional model assistant, which talks to the Ollama address you configure (default `localhost`). Progress and story-map readings are stored as plain Markdown notes in your vault.

## FAQ

**How is this different from Longform?** Longform organises scenes into a manuscript and compiles it. Creative Writer works on the prose inside the scenes and on the story as a graph. They coexist happily; Longform projects are read as ordinary folders.

**Does it work on mobile?** Not yet — Zen Mode and the editor decorations are desktop-only.

**Does it need an AI?** No. Everything except the model assistant is deterministic and offline.

## Support

Creative Writer is free and MIT-licensed, built in evenings around a day job. If it has made your writing sessions better, you can keep the coffee coming:

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/USERNAME)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/amancioandre)
<!-- TODO: confirm platforms; mirror them in manifest.json "fundingUrl" -->

Bug reports and ideas: [GitHub issues](https://github.com/amancioandre/creative-writer/issues). Full documentation: [amancioandre.github.io/creative-writer](https://amancioandre.github.io/creative-writer/).

## Contributing

Build, test, evaluation corpus and the Clean Architecture layout are in [docs/development](docs/development/architecture.md). Short version: `npm install && npm run build`, `npm test`.

Part-of-speech tagging by [compromise](https://github.com/spencermountain/compromise) (MIT). Concreteness norms from Brysbaert, Warriner & Kuperman (2014), CC-BY 4.0.
