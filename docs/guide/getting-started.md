# Getting started

Creative Writer is a desktop Obsidian plugin (`minAppVersion` 1.7.2). It works in **editing mode** — Source and Live Preview. Reading view has no editor underneath, so the editor features do not apply there; the panels (writing desk, story map, timeline) work everywhere.

## Install

### From the community list

Settings → Community plugins → Browse → search **Creative Writer** → Install → Enable.

### From a release

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/amancioandre/creative-writer/releases).
2. Put them in `<your vault>/.obsidian/plugins/creative-writer/`.
3. Reload Obsidian (Ctrl/Cmd + R) and enable the plugin under Settings → Community plugins.

### From source

```bash
git clone https://github.com/amancioandre/creative-writer
cd creative-writer
npm install
npm run build                                  # typecheck + bundle → main.js
npm run install:vault -- /path/to/your/vault   # copies the three files into the vault
```

Then reload Obsidian and enable the plugin.

## The first five minutes

1. **Open any note and start writing.** By default the plugin runs everywhere: the current line has a faint band behind it, the rest of the page fades with distance, sentences in your paragraph get a rhythm underline, and a cliché or a passive gets a tint. Hover a tint for the note.
2. **Toggle Zen Mode** (command palette → *Toggle Zen Mode*). Ribbon, tabs, sidebars and status bar go; the page stays. Toggle again to come back.
3. **Open the writing desk** (click the readability label in the status bar, or the command). You will see today's words, your streak, the note's reading-ease band and its scenes.
4. **Declare a project.** Add `writing-target: 50000` to the front matter of a note; its folder is now a project with a pace line in the desk, and a story map. See [Projects](/guide/projects).
5. **Open the story map** from the ribbon (the fork icon). Your characters and places appear once they have notes — or once names recur enough in the prose. See [Story map](/guide/story-map) and [Structuring a project](/guide/story-projects).

## Turning things off

Every feature has a toggle in Settings → Creative Writer. The master switch, *Enabled*, and the *Toggle Creative Writer (everywhere)* command stop all editor features at once. To keep the plugin out of one note, add `creative-writer: false` to its front matter; to run it only in some folders, see [Where it runs](/guide/where-it-runs).

## Optional: a local model

None of the above needs a model. If you want the model assistant, myth reports and the story map's relationship reading, install [Ollama](https://ollama.com), pull a chat model (`ollama pull qwen2.5:7b` to start; `deepseek-r1:14b` reads myth and relationships noticeably better), and set Settings → Model assistant → Model to *Local (Ollama)*. Everything stays on your machine. See [Model assistant](/guide/model-assistant).

## Optional: Harper

Creative Writer deliberately does not check spelling, grammar, punctuation or filler words. [Harper](https://writewithharper.com) does, offline, and the two are designed to run together. See [Harper companion](/reference/harper).
