import { snapshotNote, snapshotPath } from "../../domain/plot/Snapshot";
import type { ProjectSpec } from "../../domain/progress/Project";
import type { BuildPlotGrid } from "./BuildPlotGrid";
import type { NoteWriter } from "./ExportManuscript";

/** Writes the grid as a dated markdown table beside the project, and says where. Overwrites the same day's snapshot. */
export class SnapshotPlotGrid {
  constructor(private readonly grid: BuildPlotGrid, private readonly writer: NoteWriter, private readonly today: () => string = () => new Date().toISOString().slice(0, 10)) {}

  async execute(project: ProjectSpec, dated = true): Promise<string> {
    const grid = await this.grid.execute(project);
    const day = dated ? this.today() : null;
    const path = snapshotPath(project, day);
    await this.writer.write(path, snapshotNote(grid, project, day));
    return path;
  }
}
