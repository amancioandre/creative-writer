/**
 * Models paraphrase. One reading says "eye colour: green", the next
 * "eyes: green eyes", a third "eye color: Green". These are the same fact
 * and must not be flagged against each other; "green" against "grey"
 * must. The rules here are deliberately small and literal — every one of
 * them is a case a test names — because a clever normaliser that merges
 * "tall" with "small" is worse than a dumb one that misses a paraphrase.
 */
const ARTICLE = /^(?:the|a|an)\s+/;
const SPELLING: Readonly<Record<string, string>> = { color: "colour", colors: "colours", gray: "grey", center: "centre", favorite: "favourite", armor: "armour" };
const NUMBERS: Readonly<Record<string, string>> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
};
const AGE_SUFFIX = /\b(?:years?|yrs?)(?:\s+old)?\b/g;

/** Lowercase, accents off, punctuation out, one space between words. */
function base(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** "eyes" → "eye", "dress" stays; only long words, so "is" and "was" survive. */
function singular(w: string): string {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

function word(w: string): string {
  return singular(SPELLING[w] ?? w);
}

export function normAttr(attribute: string): string {
  return base(attribute).replace(ARTICLE, "").split(" ").filter(Boolean).map(word).join(" ");
}

/**
 * Attributes that hold a list, not a single value: someone owns many
 * things, knows many things, has several scars and siblings. Two
 * different values are two entries, not a contradiction — such facts
 * still make threads (who knows what, and when), but never red arcs.
 */
const ACCUMULATIVE_HEADS = new Set(["own", "owns", "has", "have", "carries", "carry", "possession", "possess", "possesses", "know", "knows", "knowledge", "told", "said", "wound", "scar", "injury", "sibling", "child", "children", "friend", "enemy", "ally", "skill", "language", "weapon", "wears", "wear"]);

export function isAccumulative(attribute: string): boolean {
  const words = normAttr(attribute).split(" ").filter(Boolean);
  return words.length > 0 && (ACCUMULATIVE_HEADS.has(words[0]!) || ACCUMULATIVE_HEADS.has(words[words.length - 1]!));
}

/**
 * The value with everything the attribute already says taken out: under
 * "eye colour", "green eyes" is "green"; under "age", "twenty-seven years
 * old" is "27".
 */
export function normValue(value: string, attribute = ""): string {
  const attrWords = new Set(normAttr(attribute).split(" ").filter(Boolean));
  const words = base(value).replace(AGE_SUFFIX, " ").replace(ARTICLE, "").split(" ").filter(Boolean)
    .map((w) => NUMBERS[w] ?? word(w))
    .filter((w) => !attrWords.has(w));
  const out = words.join(" ");
  // A value that was nothing but the attribute's own words ("eyes" under "eyes") keeps its base form rather than vanishing.
  return out || base(value);
}

/**
 * Do two values of the same attribute disagree? Equal after normalising
 * is agreement; one being a wordier version of the other ("tall", "very
 * tall") is agreement; anything else is a contradiction to show the writer.
 */
export function valuesConflict(a: string, b: string, attribute = ""): boolean {
  const na = normValue(a, attribute), nb = normValue(b, attribute);
  if (!na || !nb || na === nb) return false;
  const wa = new Set(na.split(" ")), wb = new Set(nb.split(" "));
  const subset = (x: Set<string>, y: Set<string>) => [...x].every((w) => y.has(w));
  return !subset(wa, wb) && !subset(wb, wa);
}
