import type { TimelineRow } from "../story/StoryGraph";
import { isLiveContradiction, type Contradiction, type SceneSlot, type Strip, type Thread } from "./Thread";

/**
 * What runs under the axis. Story-level signals — how many people are on
 * stage, how many threads pass through, where the contradictions
 * cluster — and, as a summary of the echo finder, where the echoes
 * land. Repetition inside a paragraph stays the editor's business;
 * across scenes it is the shape of a habit over the book, and that is
 * this view's. Counts that scale with length are normalised per
 * thousand words so a long chapter does not look guilty for being long.
 */
export function computeStrips(scenes: readonly SceneSlot[], timeline: readonly TimelineRow[], threads: readonly Thread[], contradictions: readonly Contradiction[]): Strip[] {
  const n = scenes.length;
  const zeros = () => new Array<number>(n).fill(0);

  const cast = timeline.map((r) => r.present.length);

  const firstSeen = zeros();
  const seen = new Set<string>();
  timeline.forEach((r, i) => { for (const id of r.present) if (!seen.has(id)) { seen.add(id); firstSeen[i]!++; } });

  const touching = zeros();
  for (const t of threads) if (t.kind !== "echo") for (const i of new Set(t.refs.map((r) => r.index))) if (i >= 0 && i < n) touching[i]!++;

  // Where the echoes land — a summary only; the pair is the finding.
  const echoes = zeros();
  for (const t of threads) if (t.kind === "echo") for (const r of t.refs) if (r.index >= 0 && r.index < n) echoes[r.index]!++;

  const clashes = zeros();
  for (const c of contradictions) if (isLiveContradiction(c)) for (const i of new Set([c.a.index, c.b.index])) if (i >= 0 && i < n) clashes[i]!++;
  const perThousand = clashes.map((c, i) => (c === 0 ? 0 : Math.round((c / Math.max(1, scenes[i]!.words)) * 1000 * 100) / 100));

  // What the reader is carrying: from a plant to the payoff that keeps it (to the end of the book when none
  // does), or, on a thread with no roles, from its first stop to its last.
  const open = zeros();
  for (const t of threads) {
    if (t.kind !== "writer") continue;
    const idx = t.refs.map((r) => r.index).filter((i) => i >= 0);
    if (t.directed) {
      for (const p of t.refs) {
        if (p.role !== "plant" || p.index < 0) continue;
        const end = t.refs.filter((o) => (o.role === "payoff" || o.role === "reversal") && o.index > p.index).map((o) => o.index);
        const last = end.length ? Math.min(...end) : n;
        for (let i = p.index; i < last && i < n; i++) open[i]!++;
      }
      continue;
    }
    if (idx.length < 2) continue;
    const first = Math.min(...idx), last = Math.max(...idx);
    for (let i = first; i < last && i < n; i++) open[i]!++;
  }

  return [
    { id: "cast", label: "Cast on stage", unit: "names", values: cast },
    { id: "first-appearances", label: "First appearances", unit: "names", values: firstSeen },
    { id: "threads", label: "Threads through", unit: "threads", values: touching },
    { id: "contradictions-per-1k", label: "Contradictions per 1k words", unit: "per 1k", values: perThousand, higherIsBetter: false },
    { id: "open-writer-threads", label: "Open threads (yours)", unit: "threads", values: open },
    { id: "echoes", label: "Echoes", unit: "echoes", values: echoes, higherIsBetter: false },
  ];
}
