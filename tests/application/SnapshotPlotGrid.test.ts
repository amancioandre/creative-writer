import { describe, it, expect } from "vitest";
import { SnapshotPlotGrid } from "../../src/application/use-cases/SnapshotPlotGrid";
import type { BuildPlotGrid } from "../../src/application/use-cases/BuildPlotGrid";
import { EMPTY_PLOT_GRID } from "../../src/domain/plot/PlotGrid";
import type { ProjectSpec } from "../../src/domain/progress/Project";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };

describe("SnapshotPlotGrid", () => {
  it("builds the grid, writes the dated note, and returns its path", async () => {
    const written: [string, string][] = [];
    const grid = { execute: async () => ({ ...EMPTY_PLOT_GRID, project: "Novel" }) } as unknown as BuildPlotGrid;
    const use = new SnapshotPlotGrid(grid, { write: async (p, c) => { written.push([p, c]); } }, () => "2026-09-13");
    expect(await use.execute(novel)).toBe("Novel/Plot grid · 2026-09-13.md");
    expect(written[0]![0]).toBe("Novel/Plot grid · 2026-09-13.md");
    expect(written[0]![1]).toContain("creative-writer-grid-snapshot: 1");
    expect(await use.execute(novel, false)).toBe("Novel/Plot grid.md");
  });
});
