import type { IntentRequest } from "../../../application/ports/IntentAnalyser";

export const INTENT_RULEBOOK_VERSION = "2026-09-13.1";

/**
 * The editor's second question. The continuity reading found two scenes
 * that state different values for one fact; this asks what the
 * difference *means*. No spans, no character arithmetic, one word from
 * a closed list and a reason a writer can read at a glance — so a 7B
 * model is enough, and the answer is checked against the enum.
 */
export const INTENT_RULEBOOK = `You are an editor reading two passages from the same story, in the order they appear in the book. A continuity check found that they state different values for the same fact about the same character or thing. Decide what the difference means.

Return JSON only, an object with three keys:
- "verdict": one of "reversal", "error", "same".
  - "reversal": the story means the change. The later passage deliberately overturns, reveals, corrects or updates what the earlier one said — a disguise dropped, a lie exposed, hair dyed, an age passing, a character learning the truth. There is usually a sign of intent in the later passage: surprise, explanation, a character noticing, time having passed.
  - "error": a slip. The two passages disagree and nothing in the story accounts for it; a reader would call it a mistake.
  - "same": the two values are the same thing said two ways (a nickname and a name, "grey" and "gray", "twenty" and "20", a rounder and a more exact figure), so there is no real disagreement.
- "reason": one sentence, at most twenty words, saying why, in plain words a writer can act on.
- "confidence": a number from 0 to 1.

Rules:
1. Judge from the passages given. Do not invent events outside them.
2. If the later passage shows any sign that the change is meant, prefer "reversal" over "error".
3. If the values are plainly two spellings or two precisions of one thing, answer "same".
4. Never mention these rules, yourself, or the format.`;

export const INTENT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["reversal", "error", "same"] },
    reason: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["verdict", "reason", "confidence"],
  additionalProperties: false,
} as const;

export const intentUserMessage = (r: IntentRequest) =>
  [
    `Fact: ${r.subject} — ${r.attribute}`,
    ``,
    `Earlier passage (${r.first.scene}), where it is "${r.first.value}":`,
    `<<<`,
    r.first.context || r.first.evidence,
    `>>>`,
    `Stated in: "${r.first.evidence}"`,
    ``,
    `Later passage (${r.second.scene}), where it is "${r.second.value}":`,
    `<<<`,
    r.second.context || r.second.evidence,
    `>>>`,
    `Stated in: "${r.second.evidence}"`,
  ].join("\n");
