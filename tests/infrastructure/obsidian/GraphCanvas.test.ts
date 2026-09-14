import { describe, it, expect } from "vitest";
import { GraphCanvas } from "../../../src/infrastructure/obsidian/views/GraphCanvas";

describe("GraphCanvas", () => {
  it("measures its box once per gesture and converts from the cache while the pointer moves", () => {
    const host = document.body.createDiv();
    const canvas = new GraphCanvas(host, { cls: "c", minZoom: 0.1, maxZoom: 4, interactive: ".node", onTap: () => undefined, onView: () => undefined });
    let reads = 0;
    const original = canvas.svg.getBoundingClientRect.bind(canvas.svg);
    canvas.svg.getBoundingClientRect = () => { reads += 1; return original(); };
    const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
    node.setAttribute("class", "node");
    canvas.viewport.appendChild(node);
    const moves: number[] = [];
    canvas.attachDrag(node, { onMove: (w) => moves.push(w.x), onEnd: () => undefined });
    node.dispatchEvent(new MouseEvent("pointerdown", { clientX: 0, clientY: 0, bubbles: true }));
    expect(reads).toBe(1);
    for (let i = 1; i <= 20; i++) node.dispatchEvent(new MouseEvent("pointermove", { clientX: i * 5, clientY: 0, bubbles: true }));
    expect(reads).toBe(1);
    expect(moves.length).toBeGreaterThan(0);
    node.dispatchEvent(new MouseEvent("pointerup", { clientX: 100, clientY: 0, bubbles: true }));
    // size() answers from the cache too; a fit measures afresh.
    canvas.size();
    expect(reads).toBe(1);
    canvas.fit({ x: 0, y: 0, w: 100, h: 100 });
    expect(reads).toBe(2);
    host.remove();
  });
});
