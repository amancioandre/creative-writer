/**
 * Everything the release note says, in one place. UPDATE is rewritten for
 * every minor or major release (see docs/development/publishing.md); a patch
 * release leaves it alone. Nothing here is fetched and no URL carries a
 * query string: the note is built into the plugin and identifies nobody.
 */
export interface NoteCopy {
  readonly headline: string;
  /** At most three. */
  readonly bullets: readonly string[];
}

/** The feedback form. The version is a question on the form, never a parameter here. */
export const FORM_URL = "https://tally.so/r/obJ6AN";
export const RELEASE_URL = (version: string): string => `https://github.com/amancioandre/creative-writer/releases/tag/${version}`;
export const GUIDE_URL = "https://amancioandre.github.io/creative-writer/guide/getting-started";

export const ASK = "Two minutes of your time would help the next version: what works, what is missing, and whether you want news of the suite.";

export const WELCOME: NoteCopy = {
  headline: "Thanks for installing.",
  bullets: [
    "Zen Mode and the editor lenses work in any note",
    "The story tools start from a folder with story: true in a note's front matter",
    "The writer board is the ribbon icon",
  ],
};

export const UPDATE: NoteCopy = {
  headline: "A summary under every column's name",
  bullets: [
    "Double-click under a column's name and write what the arc is or what the theme argues; it lives as a comment under the heading",
    "A scale word deleted in the cell now comes off the stop",
    "The value gauge from 0.14.0: a scale per theme, pipes per scene, a line where the story flips",
  ],
};
