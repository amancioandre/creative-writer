import type { Edge, Entity } from "./StoryGraph";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LayoutOptions {
  readonly width: number;
  readonly height: number;
  readonly iterations: number;
}

/**
 * Fruchterman–Reingold, deterministic. Nodes start on a spiral in name
 * order, so the same story lays out the same way every time on every
 * machine — a writer learns where their people are. Pinned positions
 * (dragged nodes) are honoured.
 */
export function forceLayout(entities: readonly Entity[], edges: readonly Edge[], options: LayoutOptions, pinned: ReadonlyMap<string, Point> = new Map()): Map<string, Point> {
  const n = entities.length;
  const pos = new Map<string, { x: number; y: number }>();
  if (n === 0) return pos;
  const cx = options.width / 2, cy = options.height / 2;
  const radius = Math.min(options.width, options.height) * 0.4;
  entities.forEach((e, i) => {
    const p = pinned.get(e.id);
    if (p) { pos.set(e.id, { x: p.x, y: p.y }); return; }
    if (n === 1) { pos.set(e.id, { x: cx, y: cy }); return; }
    const a = i * 2.399963; // golden angle: an even spiral with no two nodes on a line
    const r = radius * Math.sqrt((i + 0.5) / n);
    pos.set(e.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });
  if (n === 1) return pos;

  const ids = entities.map((e) => e.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const links = edges.filter((e) => index.has(e.from) && index.has(e.to) && e.kind !== "appearance").map((e) => ({ a: e.from, b: e.to, w: Math.min(3, Math.sqrt(e.weight)) }));
  const area = options.width * options.height;
  const k = Math.sqrt(area / n) * 0.8;
  let temp = Math.min(options.width, options.height) / 8;
  const cool = temp / options.iterations;

  for (let it = 0; it < options.iterations; it++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < n; i++) {
      const a = pos.get(ids[i]!)!, da = disp.get(ids[i]!)!;
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(ids[j]!)!, db = disp.get(ids[j]!)!;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = 0.01 * ((i - j) % 2 ? 1 : -1); dy = 0.01; d = 0.014; }
        const f = (k * k) / d;
        da.x += (dx / d) * f; da.y += (dy / d) * f;
        db.x -= (dx / d) * f; db.y -= (dy / d) * f;
      }
    }
    for (const l of links) {
      const a = pos.get(l.a)!, b = pos.get(l.b)!;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const f = (d * d) / k * l.w;
      const da = disp.get(l.a)!, db = disp.get(l.b)!;
      da.x -= (dx / d) * f; da.y -= (dy / d) * f;
      db.x += (dx / d) * f; db.y += (dy / d) * f;
    }
    for (const id of ids) {
      if (pinned.has(id)) continue;
      const p = pos.get(id)!, d = disp.get(id)!;
      // Gentle pull to the centre keeps disconnected nodes in view.
      d.x += (cx - p.x) * 0.02; d.y += (cy - p.y) * 0.02;
      const len = Math.max(0.01, Math.hypot(d.x, d.y));
      const step = Math.min(len, temp);
      p.x = clamp(p.x + (d.x / len) * step, 20, options.width - 20);
      p.y = clamp(p.y + (d.y / len) * step, 20, options.height - 20);
    }
    temp = Math.max(0.5, temp - cool);
  }
  return pos;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
