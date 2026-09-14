import { quoteSpans } from "../style/Quotes";

/**
 * How a writer marks speech and thought on the page. Speech is quoted
 * (double or single) or opened by a dash on its own line (the travessão of
 * Portuguese and French prose); a thought is italics that make a whole
 * paragraph or a whole sentence, `_He is guessing,_ she thought.`, or any
 * italic run, a single-quoted run, or whatever pattern the writer gives.
 * A word or two in italics inside a sentence is emphasis and never a
 * thought under the default.
 */
export type DialogueMarks = "double" | "single" | "dash" | "none";
export const DIALOGUE_MARKS: readonly DialogueMarks[] = ["double", "single", "dash", "none"];

export type ThoughtMarks = "italic-paragraph" | "italic-any" | "single-quotes" | "custom" | "none";
export const THOUGHT_MARKS: readonly ThoughtMarks[] = ["italic-paragraph", "italic-any", "single-quotes", "custom", "none"];

export interface DialogueConventions {
  readonly marks: DialogueMarks;
  readonly thoughts: ThoughtMarks;
  /** With `custom`: a regular expression; every match in a paragraph is a thought (group 1 when there is one). */
  readonly thoughtPattern: string;
}

export const DEFAULT_CONVENTIONS: DialogueConventions = { marks: "double", thoughts: "italic-paragraph", thoughtPattern: "" };

export type DialogueKind = "speech" | "thought";

/** Offsets relative to the paragraph the spans were found in. */
export interface DialogueSpan {
  readonly from: number;
  readonly to: number;
  readonly kind: DialogueKind;
}

/** `dialogue:` in a project note, in the writer's words. */
export function parseDialogueMarks(raw: unknown): DialogueMarks | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (["double", "quotes", "double-quotes", "double quotes"].includes(v)) return "double";
  if (["single", "single-quotes", "single quotes"].includes(v)) return "single";
  if (["dash", "dashes", "em-dash", "em dash", "travessão", "travessao"].includes(v)) return "dash";
  if (["none", "off"].includes(v)) return "none";
  return undefined;
}

/** `thoughts:` in a project note: a preset, or a pattern of the writer's own. */
export function parseThoughtMarks(raw: unknown): { thoughts: ThoughtMarks; thoughtPattern?: string } | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const v = raw.trim();
  const l = v.toLowerCase();
  if (["italic-paragraph", "paragraph-italic", "italic", "italics", "paragraph"].includes(l)) return { thoughts: "italic-paragraph" };
  if (["italic-any", "any-italic", "any italics"].includes(l)) return { thoughts: "italic-any" };
  if (["single-quotes", "single", "single quotes"].includes(l)) return { thoughts: "single-quotes" };
  if (["none", "off"].includes(l)) return { thoughts: "none" };
  return { thoughts: "custom", thoughtPattern: v };
}

/** The paragraph with every `%% comment %%` turned to spaces: not prose, but the offsets must hold. */
export function blankComments(text: string): string {
  return text.replace(/%%[^%\n]*%%/g, (m) => " ".repeat(m.length));
}

export function findDialogue(paragraph: string, c: DialogueConventions): DialogueSpan[] {
  const speech = speechSpans(paragraph, c.marks).map(([from, to]) => ({ from, to, kind: "speech" as const }));
  const thoughts = thoughtSpans(paragraph, c)
    .filter(([a, b]) => !speech.some((s) => a < s.to && b > s.from))
    .map(([from, to]) => ({ from, to, kind: "thought" as const }));
  return [...speech, ...thoughts].filter((s) => s.to > s.from).sort((a, b) => a.from - b.from);
}

type Span = readonly [number, number];

function speechSpans(text: string, marks: DialogueMarks): Span[] {
  switch (marks) {
    case "double": return [...quoteSpans(text)];
    case "single": return singleQuoteSpans(text);
    case "dash": return dashSpans(text);
    case "none": return [];
  }
}

const OPENER_BEFORE = /[\s([—–-]/;
const CLOSER_AFTER = /[\s.,;:!?)\]—–-]/;

/**
 * Single quotes have to be told from apostrophes: a straight `'` opens only
 * at the start or after a space or bracket, and closes only before a space,
 * punctuation or the end. Curly ‘ ’ pair on their own.
 */
export function singleQuoteSpans(text: string): Span[] {
  const spans: Span[] = [];
  let open: number | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const before = i === 0 ? " " : text[i - 1]!;
    const after = i + 1 >= text.length ? " " : text[i + 1]!;
    if (open === null) {
      if (ch === "‘" || (ch === "'" && OPENER_BEFORE.test(before) && !/\s/.test(after))) open = i;
    } else if (ch === "’" || ch === "'") {
      if (ch === "’" ? !/[\p{L}\p{N}]/u.test(after) || /\s/.test(before) : CLOSER_AFTER.test(after)) {
        spans.push([open, i + 1]);
        open = null;
      }
    }
  }
  if (open !== null) spans.push([open, text.length]);
  return spans;
}

const DASH_LINE = /^\s*[—–]/;
const INNER_DASH = /\s[—–]/g;

/** A paragraph that opens with a dash is speech; each further dash toggles between narration and speech. */
export function dashSpans(text: string): Span[] {
  if (!DASH_LINE.test(text)) return [];
  const cuts = [text.search(/[—–]/)];
  for (const m of text.matchAll(INNER_DASH)) if (m.index + 1 > cuts[0]!) cuts.push(m.index + 1);
  const spans: Span[] = [];
  for (let i = 0; i < cuts.length; i += 2) spans.push([cuts[i]!, cuts[i + 1] ?? text.length]);
  return spans;
}

const ITALIC_PARAGRAPH = /^(\s*)([*_])(?!\2)((?:(?!\2)[\s\S])+)\2([.!?…,;:]*)\s*$/;
const ITALIC_ANY = /(?<![*_\p{L}\p{N}])([*_])(?!\1)(?:(?!\1)[^\n])+?\1(?![*_\p{L}\p{N}])/gu;
/** "…, she thought.", "— he wondered": a thought tag right after the italics. */
const THOUGHT_TAG = /^[,.;:—–-]?\s*(?:[\p{L}']+\s+){0,2}(?:thought|thinks|thinking|wondered|wonders|mused|reflected|realised|realized|decided|hoped|prayed|remembered|considered|told (?:him|her|them)self)\b/iu;
/** Where a sentence may begin: the start, a full stop, a closing quote, a dash or a colon before the italics. */
const SENTENCE_BEFORE = /(?:^|[.!?…"”’)]|[—–:])\s*$/;
const MIN_THOUGHT_WORDS = 3;

/** Italic runs that are thoughts: the whole paragraph, or a whole sentence (three words or more, where a sentence begins, or followed by a thought tag). */
function italicThoughts(text: string): Span[] {
  const whole = ITALIC_PARAGRAPH.exec(text);
  if (whole) { const from = whole[1]!.length; return [[from, from + 1 + whole[3]!.length + 1 + whole[4]!.length]]; }
  const out: Span[] = [];
  for (const m of text.matchAll(ITALIC_ANY)) {
    const inner = m[0].slice(1, -1).trim();
    if (inner.split(/\s+/).length < MIN_THOUGHT_WORDS) continue;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (SENTENCE_BEFORE.test(before) || THOUGHT_TAG.test(after)) out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

function thoughtSpans(text: string, c: DialogueConventions): Span[] {
  switch (c.thoughts) {
    case "italic-paragraph": return italicThoughts(text);
    case "italic-any": return Array.from(text.matchAll(ITALIC_ANY), (m) => [m.index, m.index + m[0].length] as const);
    case "single-quotes": return c.marks === "single" ? [] : singleQuoteSpans(text);
    case "custom": return customSpans(text, c.thoughtPattern);
    case "none": return [];
  }
}

const compiled = new Map<string, RegExp | null>();

/** The writer's own pattern, compiled once; an invalid one matches nothing. */
function customSpans(text: string, pattern: string): Span[] {
  if (!pattern.trim()) return [];
  let re = compiled.get(pattern);
  if (re === undefined) {
    try { re = new RegExp(pattern, "gud"); } catch { re = null; }
    compiled.set(pattern, re);
  }
  if (!re) return [];
  const out: Span[] = [];
  for (const m of text.matchAll(re)) {
    const group = m.indices?.[1];
    const [a, b] = group ?? [m.index, m.index + m[0].length];
    if (b > a) out.push([a, b]);
  }
  return out;
}

/** The conventions the active note falls under: the project's own on top of the vault-wide ones. */
export function resolveConventions(base: DialogueConventions, override: Partial<DialogueConventions> | undefined): DialogueConventions {
  return override ? { ...base, ...override } : base;
}
