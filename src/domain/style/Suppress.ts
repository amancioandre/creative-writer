import type { FindingKind } from "./Finding";

/**
 * The writer's "not here": a hidden comment in the paragraph, `%% not cliche %%`,
 * written from the hover box, that keeps that kind of finding out of the
 * paragraph. Obsidian never renders it and the manuscript export strips it.
 */
const NOT = /%%\s*not\s+([a-z]+)\s*%%/gi;

export function suppressedKinds(paragraph: string): Set<string> {
  const out = new Set<string>();
  for (const m of paragraph.matchAll(NOT)) out.add(m[1]!.toLowerCase());
  return out;
}

export function suppressComment(kind: FindingKind): string {
  return `%% not ${kind} %%`;
}

/** How the action names a kind: "Not a cliché here". */
export const KIND_PHRASES: Readonly<Record<FindingKind, string>> = {
  cliche: "a cliché", passive: "a passive", filter: "a filter verb", adverb: "an adverb to cut", repetition: "repetition", metaphor: "a metaphor", nominalization: "a nominalisation", weakverb: "a weak verb",
};
