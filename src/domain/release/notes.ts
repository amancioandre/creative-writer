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
  headline: "A note after updates, and a way to talk back",
  bullets: [
    "This note: once after install and once after a minor update, never on a patch",
    "Tell me how it goes opens a two-minute form; nothing is sent otherwise",
    "Turn it off under Settings → Where it runs → Release notes",
  ],
};
