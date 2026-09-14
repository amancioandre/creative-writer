import { snapshotNote, snapshotPath } from "../../domain/plot/Snapshot";
import type { ProjectSpec } from "../../domain/progress/Project";
import type { BuildPlotGrid } from "./BuildPlotGrid";
import type { NoteWriter } from "./ExportManuscript";

/** Writes the grid as a dated markdown table beside the project, and says where. Overwrites the same day's snapshot. */
export class SnapshotPlotGrid {
  constructor(private readonly grid: BuildPlotGrid, private readonly writer: NoteWriter, private readonly today: () => string = () => new Date().toISOString().slice(0, 10)) {}

  async execute(project: ProjectSpec): Promise<string> {
    const grid = await this.grid.execute(project);
    const path = snapshotPath(project, this.today());
    await this.writer.write(path, snapshotNote(grid, project, this.today()));
    return path;
  }
}
