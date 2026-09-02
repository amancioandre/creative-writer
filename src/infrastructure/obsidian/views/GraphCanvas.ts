import type { Point, Rect, ViewTransform } from "../../../domain/writer/WriterFile";

const SVG = "http://www.w3.org/2000/svg";

export interface GraphCanvasOptions {
  /** Class on the `<svg>`. */
  readonly cls: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  /** Elements that take their own pointer events (nodes, cards): a pointer down on one never pans. */
  readonly interactive: string;
  /** A click on the background that did not pan. */
  readonly onTap: () => void;
  readonly onDoubleClick?: (world: Point) => void;
  /** After every pan or zoom. */
  readonly onView: () => void;
}

export interface DragHandlers {
  /** Called once the pointer has moved past the click threshold; `world` is the pointer in graph space, `d` the offset from the press in graph units. */
  readonly onMove: (world: Point, d: Point) => void;
  /** `moved` is false for a click. */
  readonly onEnd: (moved: boolean, ev: PointerEvent) => void;
}

/**
 * The pan-and-zoom surface the story map and the writer board share: an
 * SVG that fills its host, a viewport group carrying the transform, wheel
 * zoom about the cursor, drag-to-pan on the background, and a fit. Views
 * draw into `viewport` and call `paint` after changing the transform.
 */
export class GraphCanvas {
  readonly svg: SVGSVGElement;
  readonly viewport: SVGGElement;
  view: ViewTransform = { x: 0, y: 0, k: 1 };

  constructor(host: HTMLElement, private readonly opts: GraphCanvasOptions) {
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", opts.cls);
    this.svg.setAttribute("role", "img");
    host.appendChild(this.svg);
    this.viewport = document.createElementNS(SVG, "g");
    this.svg.appendChild(this.viewport);
    this.attachPanZoom();
  }

  private size(): { w: number; h: number } {
    const rect = this.svg.getBoundingClientRect();
    return { w: rect.width || this.svg.clientWidth || 800, h: rect.height || this.svg.clientHeight || 600 };
  }

  toWorld(clientX: number, clientY: number): Point {
    const rect = this.svg.getBoundingClientRect();
    return { x: (clientX - rect.left - this.view.x) / this.view.k, y: (clientY - rect.top - this.view.y) / this.view.k };
  }

  toScreen(p: Point): Point {
    return { x: p.x * this.view.k + this.view.x, y: p.y * this.view.k + this.view.y };
  }

  paint(): void {
    this.viewport.setAttribute("transform", `translate(${f(this.view.x)} ${f(this.view.y)}) scale(${this.view.k.toFixed(3)})`);
  }

  setView(view: ViewTransform): void {
    this.view = { x: view.x, y: view.y, k: clamp(view.k, this.opts.minZoom, this.opts.maxZoom) };
    this.paint();
  }

  zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = this.svg.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const k = clamp(this.view.k * factor, this.opts.minZoom, this.opts.maxZoom);
    const ratio = k / this.view.k;
    this.view = { k, x: px - (px - this.view.x) * ratio, y: py - (py - this.view.y) * ratio };
    this.paint();
    this.opts.onView();
  }

  /** Zoom and pan so a rectangle of graph space fills the surface, never past 1:1 unless asked. */
  fit(bounds: Rect, pad = 40, maxK = 1): void {
    const { w, h } = this.size();
    const bw = Math.max(1, bounds.w + 2 * pad), bh = Math.max(1, bounds.h + 2 * pad);
    const k = clamp(Math.min(w / bw, h / bh, maxK), this.opts.minZoom, this.opts.maxZoom);
    this.view = { k, x: w / 2 - (bounds.x + bounds.w / 2) * k, y: h / 2 - (bounds.y + bounds.h / 2) * k };
    this.paint();
    this.opts.onView();
  }

  private attachPanZoom(): void {
    let pan: { x: number; y: number; vx: number; vy: number } | null = null;
    let moved = false;
    this.svg.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element | null)?.closest?.(this.opts.interactive)) return;
      pan = { x: ev.clientX, y: ev.clientY, vx: this.view.x, vy: this.view.y };
      moved = false;
      this.svg.setPointerCapture?.(ev.pointerId);
    });
    this.svg.addEventListener("pointermove", (ev) => {
      if (!pan) return;
      const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      this.view = { ...this.view, x: pan.vx + dx, y: pan.vy + dy };
      this.paint();
    });
    const end = () => {
      if (!pan) return;
      if (moved) this.opts.onView(); else this.opts.onTap();
      pan = null;
    };
    this.svg.addEventListener("pointerup", end);
    this.svg.addEventListener("pointercancel", end);
    this.svg.addEventListener("dblclick", (ev) => {
      if ((ev.target as Element | null)?.closest?.(this.opts.interactive)) return;
      this.opts.onDoubleClick?.(this.toWorld(ev.clientX, ev.clientY));
    });
    this.svg.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      this.zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });
  }

  /** Drag on an element in graph space; a press that does not move is a click. */
  attachDrag(el: Element, handlers: DragHandlers): void {
    let start: { x: number; y: number; world: Point } | null = null;
    let moved = false;
    el.addEventListener("pointerdown", (e) => {
      const ev = e as PointerEvent;
      ev.stopPropagation();
      start = { x: ev.clientX, y: ev.clientY, world: this.toWorld(ev.clientX, ev.clientY) };
      moved = false;
      (el as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(ev.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      const ev = e as PointerEvent;
      if (!start) return;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
      moved = true;
      const world = this.toWorld(ev.clientX, ev.clientY);
      handlers.onMove(world, { x: world.x - start.world.x, y: world.y - start.world.y });
    });
    const end = (e: Event) => {
      const ev = e as PointerEvent;
      ev.stopPropagation();
      if (!start) return;
      start = null;
      handlers.onEnd(moved, ev);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
}

export function f(n: number): string { return n.toFixed(1); }
export function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
