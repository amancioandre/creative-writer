/**
 * A small project with echoes planted on purpose. Each scene is prose
 * with paragraphs separated by a blank line. `expected` names the pairs
 * the finder must hear; `forbidden` names phrases it must never report
 * (names, dialogue tags, a repeat inside one paragraph, stock phrasing
 * that is the cliché rule's business). Used the way `metaphorCorpus.ts`
 * is: precision and recall are numbers in a test, so a threshold change
 * shows up as a number.
 */
export interface CorpusScene {
  readonly title: string;
  readonly prose: string;
}

export const ECHO_SCENES: readonly CorpusScene[] = [
  {
    title: "Harbour",
    prose: `Marta came down to the quay before the light. There was salt on the wind and the gulls were already quarrelling over the nets. She counted the boats twice, because counting was what she did when she could not think.

Ilse was waiting by the customs house with her coat buttoned to the throat. "You are late," Ilse said. Marta said nothing. The tiredness sat in her shoulders like a wet coat, and she let it sit.

Marta walked the length of the harbour wall and back. The boats rocked. The gulls quarrelled.`,
  },
  {
    title: "The crossing",
    prose: `The ferry left at noon under a sky the colour of pewter. Marta stood at the rail with her hands in her pockets and watched the town shrink to a smudge. There was salt on the wind here too, and she found she had missed it.

Below deck, Ilse slept with her mouth open. The tiredness sat in Marta's shoulders like a wet coat. She did not take it off.

"We will be there by dark," a sailor said. Marta said nothing to that either.`,
  },
  {
    title: "The house",
    prose: `The house on the hill had not changed. The same crack ran across the lintel and the same rosebush had died against the south wall. Marta counted the windows twice, because counting was what she did when she could not think clearly.

Ilse went in first. The hall smelled of cold ash and of something sweeter underneath, and Marta stood a moment in the doorway before she followed. She was tired to the bone. Tiredness sat on her shoulders, a wet coat she could not take off.

"Home," Ilse said. Marta said nothing.`,
  },
];

/** Phrases that recur across scenes and must be found as surface echoes (matched on the stemmed key, case aside). */
export const EXPECTED_PHRASES: readonly string[] = [
  "salt on the wind",
  "counting was what she did when she could not think",
  "sat in her shoulders like a wet coat",
];

/** Sentence pairs that must be found as lexical echoes: the same sentence rewritten in different words. */
export const EXPECTED_SENTENCE_PAIRS: readonly [string, string][] = [
  ["Tiredness sat on her shoulders, a wet coat she could not take off.", "The tiredness sat in her shoulders like a wet coat, and she let it sit."],
];

/** Phrases that must never be an echo of their own. */
export const FORBIDDEN_PHRASES: readonly string[] = [
  "Marta said nothing", // a name plus a dialogue tag
  "Ilse said", // a name and a tag
  "the gulls quarrelled", // twice, but inside one paragraph of one scene
  "the same", // stopwords only
];
