import type { ForceSettings } from "../settings/Settings";
import type { Edge, Entity } from "./StoryGraph";

export interface Point {
  readonly x: number;
  readonly y: number;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
}

/**
 * A live force simulation the view can tick every frame: repulsion between
 * every pair, springs along edges, a soft pull to the centre, velocity
 * damping and an "alpha" that cools until the graph rests. Deterministic
 * start (a golden-angle spiral in entity order), so the same story opens
 * the same way on every machine; pinned nodes hold their place.
 */
export class Simulation {
  private readonly bodies = new Map<string, Body>();
  private ids: string[] = [];
  private links: { a: string; b: string; w: number }[] = [];
  private alpha = 1;

  constructor(private forces: ForceSettings, private cx: number, private cy: number) {}

  /** Replace the graph, keeping positions of nodes that survive. New nodes start near a neighbour or on the spiral. */
  setGraph(entities: readonly Entity[], edges: readonly Edge[]): void {
    const next = new Map<string, Body>();
    const radius = 60 + 12 * Math.sqrt(entities.length);
    entities.forEach((e, i) => {
      const old = this.bodies.get(e.id);
      if (old) { next.set(e.id, old); return; }
      const a = i * 2.399963;
      const r = radius * Math.sqrt((i + 0.5) / Math.max(1, entities.length));
      next.set(e.id, { x: this.cx + r * Math.cos(a), y: this.cy + r * Math.sin(a), vx: 0, vy: 0, pinned: false });
    });
    this.bodies.clear();
    for (const [k, v] of next) this.bodies.set(k, v);
    this.ids = entities.map((e) => e.id);
    this.links = edges
      .filter((e) => e.kind !== "appearance" && this.bodies.has(e.from) && this.bodies.has(e.to))
      .map((e) => ({ a: e.from, b: e.to, w: Math.min(3, Math.sqrt(e.weight)) }));
    // Drop a new node next to its first neighbour rather than across the map.
    for (const l of this.links) {
      const a = this.bodies.get(l.a)!, b = this.bodies.get(l.b)!;
      if (!next.has(l.a) || !next.has(l.b)) continue;
    }
    this.reheat();
  }

  setForces(f: ForceSettings): void {
    this.forces = f;
    this.reheat(0.6);
  }

  setCenter(x: number, y: number): void {
    this.cx = x;
    this.cy = y;
  }

  reheat(alpha = 1): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  get resting(): boolean {
    return this.alpha < 0.005;
  }

  position(id: string): Point | undefined {
    const b = this.bodies.get(id);
    return b ? { x: b.x, y: b.y } : undefined;
  }

  positions(): Map<string, Point> {
    const out = new Map<string, Point>();
    for (const [id, b] of this.bodies) out.set(id, { x: b.x, y: b.y });
    return out;
  }

  /** Hold a node where the pointer put it; the rest of the graph keeps reacting. */
  drag(id: string, p: Point): void {
    const b = this.bodies.get(id);
    if (!b) return;
    b.x = p.x; b.y = p.y; b.vx = 0; b.vy = 0;
    this.reheat(0.3);
  }

  pin(id: string, pinned: boolean): void {
    const b = this.bodies.get(id);
    if (b) b.pinned = pinned;
  }

  isPinned(id: string): boolean {
    return this.bodies.get(id)?.pinned ?? false;
  }

  /** Run n ticks synchronously — a quick settle before first paint. */
  settle(n: number): void {
    for (let i = 0; i < n && !this.resting; i++) this.tick();
  }

  /** One step. Returns false once at rest so the caller can stop its frame loop. */
  tick(): boolean {
    if (this.resting) return false;
    const { repulsion, linkDistance, linkStrength, gravity } = this.forces;
    const k = repulsion * 2500;
    const n = this.ids.length;
    const bs = this.ids.map((id) => this.bodies.get(id)!);
    for (let i = 0; i < n; i++) {
      const a = bs[i]!;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j]!;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = ((i - j) % 2 ? 1 : -1) * 0.5; dy = 0.5; d2 = 0.5; }
        const d = Math.sqrt(d2);
        // Cap so that overlapping nodes do not explode; fall off with distance squared.
        const f = Math.min(80, k / d2) * this.alpha;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const l of this.links) {
      const a = this.bodies.get(l.a)!, b = this.bodies.get(l.b)!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - linkDistance) * linkStrength * l.w * 0.1 * this.alpha;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const b of bs) {
      if (b.pinned) { b.vx = 0; b.vy = 0; continue; }
      b.vx += (this.cx - b.x) * gravity * 0.1 * this.alpha;
      b.vy += (this.cy - b.y) * gravity * 0.1 * this.alpha;
      b.vx *= 0.6; b.vy *= 0.6;
      const v = Math.hypot(b.vx, b.vy);
      if (v > 30) { b.vx *= 30 / v; b.vy *= 30 / v; }
      b.x += b.vx; b.y += b.vy;
    }
    this.alpha *= 0.985;
    return !this.resting;
  }
}
