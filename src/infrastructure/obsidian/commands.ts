/**
 * The one table of the panels' commands: main.ts registers them by it and every ⋯ menu names
 * them by it, so a row in a menu and a row in Settings → Hotkeys read the same words.
 */
export const COMMANDS = {
  "open-story-map": "Open story map",
  "story-map-add-node": "Story map: add a node",
  "story-map-fit": "Story map: fit the map",
  "story-map-show-all": "Story map: show all (leave the focus)",
  "story-map-shake": "Story map: shake the layout",
  "story-map-read-project": "Story map: read project with model",
  "story-map-reset-filters": "Story map: reset filters",
  "open-story-threads": "Open story threads",
  "story-threads-zoom-in": "Story threads: zoom in",
  "story-threads-zoom-out": "Story threads: zoom out",
  "story-threads-fit": "Story threads: fit the manuscript",
  "story-threads-open-note": "Story threads: open Story threads.md",
  "story-threads-read-project": "Story threads: read project for facts",
  "read-contradictions-for-intent": "Read contradictions for intent (story threads)",
  "read-project-for-echoes": "Read project for echoes (story threads)",
  "open-story-timeline": "Open plot grid",
  "story-timeline-clear-search": "Plot grid: clear the search",
  "plot-grid-toggle-cast": "Plot grid: fold or expand the cast",
  "plot-grid-open-note": "Plot grid: open Story threads.md",
  "open-writer": "Open writer",
  "writer-next-lane": "Writer: next lane",
  "writer-previous-lane": "Writer: previous lane",
  "writer-next-group": "Writer: next group",
  "writer-previous-group": "Writer: previous group",
  "writer-new-note": "Writer: new note in the focused group",
  "writer-add-note": "Writer: add an existing note",
  "writer-new-story": "Writer: new story",
  "writer-fit": "Writer: fit the board",
  "writer-shortcuts": "Writer: show keyboard shortcuts",
  "copy-writer-schema": "Copy writer schema",
  "open-manuscript": "Open manuscript",
  "manuscript-prose-only": "Manuscript: toggle prose only",
  "manuscript-comments": "Manuscript: toggle the comments pane",
  "manuscript-ruler": "Manuscript: toggle the ruler",
  "manuscript-story": "Manuscript: toggle story marks",
  "manuscript-echoes": "Manuscript: toggle echoes",
  "export-manuscript": "Export manuscript to a note",
} as const;

export type CommandId = keyof typeof COMMANDS;

/** The name a command shows in the palette and in Settings → Hotkeys. */
export function commandName(id: CommandId): string {
  return COMMANDS[id];
}
