/**
 * A lens is a reading pass: it colours every open note one way at a time.
 * Style checks, dialogue, the writer's own word lists, and each
 * character's accent. One lens is active across the vault, kept between sessions;
 * switching one on switches the others off. The ambient editor layers
 * (focus fade, current line, typewriter, the rhythm meter in Zen Mode)
 * stay under every lens.
 */
export type Lens = "none" | "style" | "dialogue" | "words" | "accents";

/** In the order "Lens: next" walks them. */
export const LENSES: readonly Lens[] = ["none", "style", "dialogue", "words", "accents"];

export const LENS_LABELS: Readonly<Record<Lens, string>> = { none: "No lens", style: "Style checks", dialogue: "Dialogue", words: "Words", accents: "Accents" };

export function isLens(value: unknown): value is Lens {
  return typeof value === "string" && (LENSES as readonly string[]).includes(value);
}

export function nextLens(current: Lens): Lens {
  const i = LENSES.indexOf(current);
  return LENSES[(i + 1) % LENSES.length]!;
}

/** A lens command toggles its lens: on when another (or none) is on, off when it is the one on. */
export function toggleLens(current: Lens, lens: Lens): Lens {
  return current === lens ? "none" : lens;
}
