import type { FindingKind } from "../src/domain/style/Finding";
import { FINDING_KINDS } from "../src/domain/style/Finding";
import type { Labelled } from "./corpus";

export interface KindScore {
  readonly kind: FindingKind;
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface Scorecard {
  readonly byKind: readonly KindScore[];
  readonly micro: { precision: number; recall: number; f1: number };
  /** Sentences labelled clean that got any flag at all. */
  readonly cleanFalseAlarms: readonly string[];
}

/** `detected(text)` returns the kinds the checker flagged for that sentence. */
export function score(corpus: readonly Labelled[], detected: ReadonlyMap<string, ReadonlySet<FindingKind>>, kinds: readonly FindingKind[] = FINDING_KINDS): Scorecard {
  const counts = new Map<FindingKind, { tp: number; fp: number; fn: number }>(kinds.map((k) => [k, { tp: 0, fp: 0, fn: 0 }]));
  const cleanFalseAlarms: string[] = [];
  for (const item of corpus) {
    const got = detected.get(item.text) ?? new Set<FindingKind>();
    const want = new Set(item.expect);
    for (const k of kinds) {
      const c = counts.get(k)!;
      if (got.has(k) && want.has(k)) c.tp++;
      else if (got.has(k)) c.fp++;
      else if (want.has(k)) c.fn++;
    }
    if (want.size === 0 && [...got].some((k) => kinds.includes(k))) cleanFalseAlarms.push(item.text);
  }
  const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);
  const byKind = kinds.map((kind) => {
    const { tp, fp, fn } = counts.get(kind)!;
    const precision = ratio(tp, tp + fp), recall = ratio(tp, tp + fn);
    return { kind, tp, fp, fn, precision, recall, f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall) };
  });
  const tp = byKind.reduce((a, k) => a + k.tp, 0), fp = byKind.reduce((a, k) => a + k.fp, 0), fn = byKind.reduce((a, k) => a + k.fn, 0);
  const p = ratio(tp, tp + fp), r = ratio(tp, tp + fn);
  return { byKind, micro: { precision: p, recall: r, f1: p + r === 0 ? 0 : (2 * p * r) / (p + r) }, cleanFalseAlarms };
}

export function formatScorecard(title: string, s: Scorecard): string {
  const rows = s.byKind.filter((k) => k.tp + k.fp + k.fn > 0).map((k) => `  ${k.kind.padEnd(14)} P ${k.precision.toFixed(2)}  R ${k.recall.toFixed(2)}  F1 ${k.f1.toFixed(2)}   (tp ${k.tp} fp ${k.fp} fn ${k.fn})`);
  return [`${title}`, ...rows, `  ${"micro".padEnd(14)} P ${s.micro.precision.toFixed(2)}  R ${s.micro.recall.toFixed(2)}  F1 ${s.micro.f1.toFixed(2)}`, `  clean sentences wrongly flagged: ${s.cleanFalseAlarms.length}`].join("\n");
}
