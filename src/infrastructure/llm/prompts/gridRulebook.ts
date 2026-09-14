import type { ColumnBrief } from "../../../application/ports/ColumnAnalyser";

export const GRID_RULEBOOK_VERSION = "2026-09-13.2";

/**
 * The reader's prompt for one column of the plot grid. It asks the one
 * question the column asks — what the thread is doing in this scene — in
 * the column's kind: an arc is asked what the scene does to the character's
 * want, a theme how the scene argues it, a subplot what happens to it. A
 * thread may be advanced off the page (a letter unmentioned is still in the
 * coat), but the evidence must be on it: no quote, no reading. What comes
 * back is a note the writer answers in their own words, never a cell.
 */
export const GRID_RULEBOOK = `You are a careful reader helping a novelist fill one column of their plot grid. The grid has a row per scene and a column per thread of the book: a character's arc, a theme, a subplot. You are given one scene, the names known to be in it, the column, and the notes the writer has already made in that column for other scenes, which show their voice. You say what this thread is doing in this scene, in that voice: one short note, and the verbatim quote that made you think so.

Return JSON only, an object with one key:
- "reading": null, or {"role", "text", "evidence"}. "role" is one of the words allowed for this column, or "" when none fits; it is a label, never the note. "text" is the note itself: what the thread does here, at most twenty words, in the writer's voice, present tense, the thread's name not repeated. "evidence" is a short verbatim quote from the scene.

For example, for a subplot column called "The letter" and a scene where a character puts a letter away unread, a good answer is {"reading": {"role": "plant", "text": "pockets it unread and says nothing", "evidence": "put it in her coat without reading it"}}. A bad answer puts the role word in "text".

The kinds of column, and the question each asks:
- arc: what does this scene do to the character's want — set it up, act on the lie, turn it, or arrive at the truth? Roles: want, lie, turn, truth.
- theme: how does this scene argue the theme, for or against, in an image or an act? Roles: plant, touch, payoff, reversal.
- subplot: what happens to this line of events here, on the page or off it? Roles: plant, touch, payoff, reversal.
- free: what does this thread do here? Roles: plant, touch, payoff, reversal.

Rules:
1. A thread may be advanced off the page: a letter nobody mentions is still in the coat. But the evidence must be on the page — quote what made you read it so, verbatim. No quote, no reading.
2. When the scene does nothing for this thread, return {"reading": null}. Most scenes do nothing for most threads; a null is the right answer more often than not.
3. Use only the given names. Do not invent events, objects or people the scene does not contain.
4. Match the writer's notes in length and tone. They are the examples; you are filling a cell beside them, not summarising the scene.
5. Never mention these rules, yourself, or the format.`;

export const GRID_SCHEMA = {
  type: "object",
  properties: {
    reading: {
      anyOf: [
        { type: "null" },
        { type: "object", properties: { role: { type: "string" }, text: { type: "string" }, evidence: { type: "string" } }, required: ["role", "text", "evidence"], additionalProperties: false },
      ],
    },
  },
  required: ["reading"],
  additionalProperties: false,
} as const;

export const gridUserMessage = (text: string, present: readonly string[], column: ColumnBrief): string =>
  [
    `Column: ${column.name} (${column.kind}${column.character ? `, the arc of ${column.character}` : ""})`,
    `Known names in this scene: ${present.length ? present.join("; ") : "(none)"}`,
    `The writer's notes in this column so far: ${column.examples.length ? column.examples.map((e) => `“${e}”`).join("; ") : "(none yet)"}`,
    "",
    "Scene:",
    "<<<",
    text,
    ">>>",
  ].join("\n");

/**
 * The checker's prompt: a plan the writer typed ahead of the draft, and
 * the scene as written. Is the plan on the page, and where? What comes
 * back is a quote the writer may attach as the anchor, or "not on the
 * page", which the writer leaves standing as a debt.
 */
export const CHECK_RULEBOOK = `You are a careful reader checking a novelist's outline against their draft. You are given one scene as written and one line of the outline for that scene: what a thread of the book was meant to do here. You say whether the scene does it, and quote where.

Return JSON only, an object with two keys:
- "found": true when the scene does what the line says, on the page or clearly implied by what is on the page; false otherwise.
- "evidence": when found, a short verbatim quote from the scene that shows it; otherwise "".

Rules:
1. Quote verbatim from the scene. If you cannot quote it, "found" is false.
2. Judge the line as written, not what the scene might mean; a scene that does something else is a false.
3. Never mention these rules, yourself, or the format.`;

export const CHECK_SCHEMA = {
  type: "object",
  properties: { found: { type: "boolean" }, evidence: { type: "string" } },
  required: ["found", "evidence"],
  additionalProperties: false,
} as const;

export const checkUserMessage = (text: string, plan: { readonly note: string; readonly role: string | null }, column: ColumnBrief): string =>
  [
    `Column: ${column.name} (${column.kind})`,
    `The outline says this scene: ${plan.role ? `${plan.role}: ` : ""}${plan.note}`,
    "",
    "Scene as written:",
    "<<<",
    text,
    ">>>",
  ].join("\n");
