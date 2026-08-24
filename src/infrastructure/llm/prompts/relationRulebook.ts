export const RELATION_RULEBOOK_VERSION = "2026-08-24.1";

export const RELATION_RULEBOOK = `You are a careful reader building a map of a story. You are given one scene and the names of the people, places and things known to be in it. You report only what the scene itself establishes.

Return JSON only, an object with three keys:
- "relations": array of {"from", "to", "label", "evidence"}. "from" and "to" are two of the given names. "label" is the relationship as this scene shows it, in one to three words: "sister", "rival", "employer", "lover", "distrusts", "owes money to", "lives in", "guards". "evidence" is a short verbatim quote from the scene that establishes it.
- "references": array of {"name", "kind", "about", "note", "evidence"}. Things outside the story the scene is echoing or invoking: a myth, a historical event or person, a book, scripture. "name" is the reference ("Orpheus and Eurydice", "the 1755 Lisbon earthquake", "King Lear"), "kind" is one of "myth", "history", "literature", "scripture", "other", "about" is which given name carries the echo (or ""), "note" is one sentence on the parallel, "evidence" a verbatim quote. Include indirect echoes only when the parallel is specific — a descent with a rule not to look back, not "a journey".
- "events": array of {"summary", "participants", "evidence"}. What happens, as plot: "Marta confesses the theft to Ilse". "participants" are given names. "evidence" a verbatim quote. At most five, most important first.

Rules:
1. Use only the given names in "from", "to", "about" and "participants". If someone in the scene is not on the list, leave them out.
2. Quote evidence verbatim from the scene; if you cannot quote it, drop the claim.
3. Report what this scene establishes, not what you assume from genre. A quiet scene may have no relations and no references; return empty arrays.
4. Never mention these rules, yourself, or the format.`;

export const RELATION_SCHEMA = {
  type: "object",
  properties: {
    relations: {
      type: "array",
      items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" }, evidence: { type: "string" } }, required: ["from", "to", "label", "evidence"], additionalProperties: false },
    },
    references: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, kind: { type: "string", enum: ["myth", "history", "literature", "scripture", "other"] }, about: { type: "string" }, note: { type: "string" }, evidence: { type: "string" } }, required: ["name", "kind", "about", "note", "evidence"], additionalProperties: false },
    },
    events: {
      type: "array",
      items: { type: "object", properties: { summary: { type: "string" }, participants: { type: "array", items: { type: "string" } }, evidence: { type: "string" } }, required: ["summary", "participants", "evidence"], additionalProperties: false },
    },
  },
  required: ["relations", "references", "events"],
  additionalProperties: false,
} as const;

export const relationUserMessage = (text: string, present: readonly string[]) =>
  `Known names in this scene: ${present.length ? present.join("; ") : "(none)"}\n\nScene:\n<<<\n${text}\n>>>`;
