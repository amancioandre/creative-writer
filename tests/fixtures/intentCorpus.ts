import type { IntentRequest } from "../../src/application/ports/IntentAnalyser";
import type { IntentVerdict } from "../../src/domain/threads/Intent";

/**
 * Labelled contradictions for the intent reading: a reversal the story
 * means, an error nothing accounts for, or the same thing said twice.
 * Scored by `tests/eval/intent.eval.test.ts` against a live local model
 * (OLLAMA_LIVE=1), the way the style checks are, so the verdict's
 * precision is a number before it reaches a card.
 */
export const INTENT_CORPUS: ReadonlyArray<{ request: IntentRequest; verdict: IntentVerdict }> = [
  {
    request: { subject: "Ilse", attribute: "hair colour", first: { scene: "Funeral", value: "black", evidence: "her black hair", context: "Ilse stood at the back with her black hair pinned up, saying nothing to anyone." }, second: { scene: "Spring", value: "red", evidence: "her hair, red now", context: "Marta did not know her at first: her hair, red now, cut to the jaw. \"You dyed it,\" Marta said. \"After the funeral,\" said Ilse." } },
    verdict: "reversal",
  },
  {
    request: { subject: "The letter", attribute: "addressee", first: { scene: "Station", value: "Anna", evidence: "addressed to Anna", context: "The envelope was addressed to Anna in a hand she did not know, and she pocketed it without reading it." }, second: { scene: "Reading", value: "her mother", evidence: "addressed to her mother", context: "She turned it over at last. It had never been addressed to her at all; it was addressed to her mother, and the hand was her father's." } },
    verdict: "reversal",
  },
  {
    request: { subject: "Marta", attribute: "age", first: { scene: "Quay", value: "thirty-one", evidence: "thirty-one years old", context: "Marta was thirty-one years old and had never left the town." }, second: { scene: "Crossing", value: "twenty-eight", evidence: "at twenty-eight", context: "At twenty-eight, Marta thought, she should have been braver than this. The ferry rocked." } },
    verdict: "error",
  },
  {
    request: { subject: "The house", attribute: "position of the crack", first: { scene: "Arrival", value: "the lintel", evidence: "across the lintel", context: "The same crack ran across the lintel that had been there when she was a girl." }, second: { scene: "Night", value: "the sill", evidence: "along the sill", context: "She traced the crack along the sill with a finger, the way she had as a girl." } },
    verdict: "error",
  },
  {
    request: { subject: "Marta", attribute: "eye colour", first: { scene: "Harbour", value: "grey", evidence: "grey eyes", context: "Her grey eyes went to the boats and stayed there." }, second: { scene: "Dinner", value: "gray", evidence: "gray eyes", context: "Ilse watched her gray eyes over the rim of the glass." } },
    verdict: "same",
  },
  {
    request: { subject: "Zsófi", attribute: "age", first: { scene: "Camp", value: "twelve", evidence: "twelve years old", context: "Zsófi was twelve years old and sang whether anyone listened or not." }, second: { scene: "Creek", value: "12", evidence: "aged 12", context: "A girl aged 12 should not have been out at that hour, and Zsófi knew it." } },
    verdict: "same",
  },
];
