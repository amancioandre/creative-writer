export const FACT_RULEBOOK_VERSION = "2026-08-24.2";

/**
 * The continuity editor's prompt. It asks for the kind of fact a later
 * scene can contradict — a number, a colour, a birthplace, who is alive —
 * and nothing interpretive, because contradictions are found by comparing
 * values with code, and code cannot compare "seems troubled" with
 * "resigned". It also asks for *durable* facts only: where someone is
 * standing right now changes every scene by design, and reporting it
 * would flag every journey as an error. The attribute vocabulary is
 * suggested, not enforced: a model that says "eye colour" in every scene
 * gives one thread; one that alternates "eyes" and "eye colour" gives
 * two, which is a missed match, never a false alarm.
 */
export const FACT_RULEBOOK = `You are a continuity editor reading one scene of a story. You are given the names known to be in it. You list the concrete, checkable facts the scene establishes about those names — facts that should still be true in later scenes — so that later scenes can be checked against them.

Return JSON only, an object with one key:
- "facts": array of {"subject", "attribute", "value", "evidence"}. "subject" is one of the given names. "attribute" is a short noun phrase naming the kind of fact, reused exactly across scenes where it fits: "eye colour", "hair colour", "age", "height", "build", "handedness", "birthplace", "occupation", "weapon", "wound", "scar", "owns", "mother", "father", "sibling", "spouse", "alive or dead", "birth year", "knows about". "value" is the fact itself, as short as possible: "green", "27", "Bremen", "left hand", "dead", "the theft". "evidence" is a short verbatim quote from the scene that states it.

Rules:
1. Use only the given names as subjects. If someone in the scene is not on the list, leave them out.
2. Report durable facts a later scene could contradict: physical description, age, origins, family, occupation, possessions, injuries, whether someone is alive, what someone knows or has been told. Do not report where someone is at the moment, what they are doing, what they buy or eat, feelings, motives, themes, or your interpretation.
3. Quote evidence verbatim from the scene; if you cannot quote it, drop the fact.
4. One fact per attribute per subject. At most twelve facts, most concrete first.
5. A scene may state no facts at all; return an empty array.
6. Never mention these rules, yourself, or the format.`;

export const FACT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: { type: "object", properties: { subject: { type: "string" }, attribute: { type: "string" }, value: { type: "string" }, evidence: { type: "string" } }, required: ["subject", "attribute", "value", "evidence"], additionalProperties: false },
    },
  },
  required: ["facts"],
  additionalProperties: false,
} as const;

export const factUserMessage = (text: string, present: readonly string[]) =>
  `Known names in this scene: ${present.length ? present.join("; ") : "(none)"}\n\nScene:\n<<<\n${text}\n>>>`;
