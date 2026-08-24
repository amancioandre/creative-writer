import type { TimelineRow } from "../story/StoryGraph";
import type { Contradiction, SceneSlot, Strip, Thread } from "./Thread";

/**
 * What runs under the axis. Story-level signals only — how many people
 * are on stage, how many threads pass through, where the contradictions
 * cluster — never sentence-level style, which has its own tools and says
 * nothing about plot. Counts that scale with length are normalised per
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
  for (const t of threads) for (const i of new Set(t.refs.map((r) => r.index))) if (i >= 0 && i < n) touching[i]!++;

  const clashes = zeros();
  for (const c of contradictions) if (!c.dismissed) for (const i of new Set([c.a.index, c.b.index])) if (i >= 0 && i < n) clashes[i]!++;
  const perThousand = clashes.map((c, i) => (c === 0 ? 0 : Math.round((c / Math.max(1, scenes[i]!.words)) * 1000 * 100) / 100));

  const open = zeros();
  for (const t of threads) {
    if (t.kind !== "writer") continue;
    const idx = t.refs.map((r) => r.index).filter((i) => i >= 0);
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
  ];
}
