import { buildPlotGrid, type PlotGrid } from "../../domain/plot/PlotGrid";
import type { ProjectSpec } from "../../domain/progress/Project";
import type { StoryGraph } from "../../domain/story/StoryGraph";
import type { BuildStoryThreads } from "./BuildStoryThreads";
import type { OutlineRepository } from "../ports/OutlineRepository";
import { parseOutline } from "../../domain/plot/Outline";
import type { OutlinePlan } from "../../domain/plot/PlotGrid";

/**
 * The plot grid for a project: the threads model gives the columns and
 * their anchored stops, its graph the rows. One build of the vault's
 * notes serves both, so the grid costs what the threads chart costs.
 */
export class BuildPlotGrid {
  constructor(private readonly threads: BuildStoryThreads, private readonly outline?: OutlineRepository) {}

  async execute(project: ProjectSpec): Promise<PlotGrid> {
    return (await this.executeWithGraph(project)).grid;
  }

  /** The grid with the graph it was built on, for a pass that needs both. */
  async executeWithGraph(project: ProjectSpec): Promise<{ grid: PlotGrid; graph: StoryGraph }> {
    const [{ graph, model, file, hashes }, plan] = await Promise.all([this.threads.executeWithGraph(project), this.plan(project)]);
    return { grid: buildPlotGrid(graph, model, { pov: project.plotPov, time: project.plotTime, theme: project.plotTheme, beats: project.plotBeats, order: project.plotOrder, notePath: project.notePath }, { readings: file.grid, hashes }, plan), graph };
  }

  /** The outline note, when the project has one: rows for the grid until it is built, the record afterwards. */
  private async plan(project: ProjectSpec): Promise<OutlinePlan | null> {
    if (!this.outline) return null;
    const markdown = await this.outline.load(project);
    if (!markdown) return null;
    const outline = parseOutline(markdown);
    // A note called Outline with no flag is a chapter the map already reads; drawing it as the plan too would double its rows.
    return outline.flagged ? { path: this.outline.pathFor(project), outline } : null;
  }
}
