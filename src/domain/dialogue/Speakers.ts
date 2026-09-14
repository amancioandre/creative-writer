import { tokenize } from "../style/Tokenizer";
import { DIALOGUE_TAGS } from "../style/lexicon/adverbExceptions";
import { NameLookup, aliasesOf, basenameOf, entityKindOf, normalise, type EntityNote } from "../story/EntityIndex";
import { pathInScope } from "../scope/NoteScope";
import type { DialogueSpan } from "./DialogueSpans";

/**
 * Who is speaking. The cast comes from character notes (name, aliases and
 * a `colour:` of their own, else one from the palette in cast order); a
 * project note can narrow it with `speakers:`. Attribution is heuristic
 * and says how sure it is: a dialogue tag, a name in the paragraph, or
 * turn-taking between the last two voices. Anything else stays grey.
 */
export interface Speaker {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly colour: string;
  /** Words and phrases this character's speech uses (`accent:` in the note), lowercased. */
  readonly accent: readonly string[];
  /** Words this character never says (`accent-never:`), lowercased. */
  readonly accentNever: readonly string[];
}

export const SPEAKER_PALETTE: readonly string[] = ["#4a8fe2", "#c8773a", "#3fa66b", "#8e5bd6", "#d64545", "#d9a621", "#48bbaa", "#e07b39"];
export const UNATTRIBUTED_COLOUR = "#8a8a8a";

const HEX = /^#[0-9a-f]{6}$/i;

/** A list or a comma string of words, as the matcher wants them: trimmed, lowercased, straight apostrophes. */
function wordsOf(frontmatter: unknown, key: string): string[] {
  const fm = (frontmatter && typeof frontmatter === "object" ? frontmatter : {}) as Record<string, unknown>;
  const raw = fm[key];
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const w = item.trim().toLowerCase().replace(/[’ʼ‘]/g, "'");
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

function colourOf(frontmatter: unknown): string | null {
  const fm = (frontmatter && typeof frontmatter === "object" ? frontmatter : {}) as Record<string, unknown>;
  const v = fm["colour"] ?? fm["color"];
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/**
 * The cast a note can hear: character notes inside the project's scope,
 * plus those outside every project (a shared `Characters/` folder). With
 * no scope, every character note in the vault. A `speakers:` list narrows
 * and orders the cast, adds names with no note, and can pin a colour
 * (`Mara #4a8fe2`).
 */
export function buildRoster(notes: readonly EntityNote[], scope: string | null, allScopes: readonly string[], speakers?: readonly string[]): Speaker[] {
  const inCast = (path: string) => scope === null || pathInScope(path, scope) || !allScopes.some((s) => pathInScope(path, s));
  const cast: Speaker[] = [];
  for (const n of notes) {
    if (entityKindOf(n) !== "character" || !inCast(n.path)) continue;
    const name = basenameOf(n.path);
    cast.push({ id: n.path, name, aliases: aliasesOf(n.frontmatter).filter((a) => a !== name), colour: colourOf(n.frontmatter) ?? "", accent: wordsOf(n.frontmatter, "accent"), accentNever: wordsOf(n.frontmatter, "accent-never") });
  }
  let list = cast;
  if (speakers && speakers.length > 0) {
    list = [];
    for (const raw of speakers) {
      const m = /^(.*?)\s*(#[0-9a-f]{6})?\s*$/i.exec(raw.trim());
      const label = m?.[1]?.trim() ?? "";
      if (!label) continue;
      const pinned = m?.[2]?.toLowerCase();
      const key = normalise(label);
      const known = cast.find((c) => normalise(c.name) === key || c.aliases.some((a) => normalise(a) === key));
      const speaker = known ?? { id: `speaker:${key}`, name: label, aliases: [], colour: "", accent: [], accentNever: [] };
      if (!list.some((s) => s.id === speaker.id)) list.push(pinned ? { ...speaker, colour: pinned } : speaker);
    }
  }
  return list.map((s, i) => (s.colour ? s : { ...s, colour: SPEAKER_PALETTE[i % SPEAKER_PALETTE.length]! }));
}

export type AttributionHow = "tag" | "named" | "turns";

export interface Attribution {
  readonly speaker: Speaker;
  readonly how: AttributionHow;
}

export const HOW_LABELS: Readonly<Record<AttributionHow, string>> = { tag: "dialogue tag", named: "named in the paragraph", turns: "turn-taking" };
export const UNATTRIBUTED_NOTE = "speaker not found · no tag or name in this paragraph and no clean turn-taking";

export interface SpokenParagraph {
  readonly text: string;
  readonly spans: readonly DialogueSpan[];
}

const SCENE_BREAK = /^\s*(?:#{1,6}\s|\*\s*\*\s*\*|---+\s*$|___+\s*$)/;
/** Narration paragraphs an exchange may span before turn-taking stops trusting the last two voices. */
const MAX_GAP = 2;

/**
 * One attribution per paragraph, null for narration and for speech nobody
 * can be pinned to. A dialogue tag wins, then the one character named in
 * the paragraph's narration, then the turn: the voice before the last one,
 * or, when only one voice has spoken, the one other character named in
 * the scene so far. Thoughts are attributed the same way but do not take
 * a turn: they belong to the one listening. A heading or a scene break
 * starts over.
 */
export function attributeSpeakers(paragraphs: readonly SpokenParagraph[], roster: readonly Speaker[]): (Attribution | null)[] {
  const lookup = new NameLookup<Speaker>();
  for (const s of roster) for (const label of [s.name, ...s.aliases]) lookup.add(label, s);
  let history: Speaker[] = [];
  let present: Speaker[] = [];
  let gap = 0;
  const seen = (s: Speaker) => { if (!present.includes(s)) present.push(s); };

  return paragraphs.map((p) => {
    if (SCENE_BREAK.test(p.text)) { history = []; present = []; gap = 0; return null; }
    const named = namesInNarration(p, lookup);
    for (const n of named) seen(n.speaker);
    if (p.spans.length === 0) { gap += 1; return null; }
    const speaks = p.spans.some((s) => s.kind === "speech");
    let result: Attribution | null = null;
    const tagged = named.filter((n) => n.tagged);
    if (tagged.length > 0 && tagged.every((n) => n.speaker === tagged[0]!.speaker)) result = { speaker: tagged[0]!.speaker, how: "tag" };
    else if (named.length === 1 && speaks) result = { speaker: named[0]!.speaker, how: "named" };
    else if (gap <= MAX_GAP) {
      const last = history[history.length - 1];
      const before = history[history.length - 2];
      const other = last ? present.filter((s) => s !== last) : [];
      const turn = before && before !== last ? before : last && other.length === 1 ? other[0]! : null;
      if (turn && (named.length === 0 || named.some((n) => n.speaker === turn))) result = { speaker: turn, how: "turns" };
    }
    gap = 0;
    if (result) { seen(result.speaker); if (speaks) history.push(result.speaker); }
    return result;
  });
}

interface Named { readonly speaker: Speaker; readonly tagged: boolean }

/** Characters named outside the speech spans, in order of first appearance, and whether a dialogue-tag verb sits next to the name. */
export function namesInNarration(p: SpokenParagraph, lookup: NameLookup<Speaker>): Named[] {
  const out: Named[] = [];
  let at = 0;
  const segments: { from: number; text: string }[] = [];
  for (const s of p.spans) { if (s.from > at) segments.push({ from: at, text: p.text.slice(at, s.from) }); at = s.to; }
  if (at < p.text.length) segments.push({ from: at, text: p.text.slice(at) });
  for (const seg of segments) {
    const tokens = tokenize(seg.text);
    for (let i = 0; i < tokens.length; i++) {
      if (!/\p{Lu}/u.test(seg.text[tokens[i]!.from] ?? "")) continue;
      let speaker: Speaker | null = null;
      let end = i;
      const next = tokens[i + 1];
      if (next && /\p{Lu}/u.test(seg.text[next.from] ?? "") && /^\s$/.test(seg.text.slice(tokens[i]!.to, next.from))) {
        speaker = lookup.resolve(seg.text.slice(tokens[i]!.from, next.to));
        if (speaker) end = i + 1;
      }
      speaker ??= lookup.resolve(seg.text.slice(tokens[i]!.from, tokens[i]!.to));
      if (!speaker) continue;
      // "said Tomas", "said the Roarthian", "Tomas said": the verb right before the name (an article between is fine) or right after it.
      const beforeName = ARTICLES.has(tokens[i - 1]?.text ?? "") ? tokens[i - 2] : tokens[i - 1];
      const tagged = isTag(beforeName?.text) || isTag(tokens[end + 1]?.text);
      const known = out.find((n) => n.speaker === speaker);
      if (known) { if (tagged && !known.tagged) out[out.indexOf(known)] = { speaker, tagged: true }; }
      else out.push({ speaker, tagged });
      i = end;
    }
  }
  return out;
}

const isTag = (word: string | undefined) => word !== undefined && DIALOGUE_TAGS.has(word);
const ARTICLES = new Set(["the", "a", "an"]);
