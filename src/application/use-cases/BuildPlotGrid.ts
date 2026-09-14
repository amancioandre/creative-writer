import { buildPlotGrid, type PlotGrid } from "../../domain/plot/PlotGrid";
import type { ProjectSpec } from "../../domain/progress/Project";
import type { BuildStoryThreads } from "./BuildStoryThreads";

/**
 * The plot grid for a project: the threads model gives the columns and
 * their anchored stops, its graph the rows. One build of the vault's
 * notes serves both, so the grid costs what the threads chart costs.
 */
export class BuildPlotGrid {
  constructor(private readonly threads: BuildStoryThreads) {}

  async execute(project: ProjectSpec): Promise<PlotGrid> {
    const { graph, model } = await this.threads.executeWithGraph(project);
    return buildPlotGrid(graph, model);
  }
}
