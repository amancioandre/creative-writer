import type { ProjectSpec } from "../../domain/progress/Project";
import type { PlotGrid } from "../../domain/plot/PlotGrid";
import { validateProposals, type ColumnProposal, type ProposalBrief } from "../../domain/plot/Proposals";
import { sceneKey, type StoryGraph } from "../../domain/story/StoryGraph";
import type { StoryMapFile } from "../../domain/story/StoryMapFile";
import type { ColumnAnalyser } from "../ports/ColumnAnalyser";
import type { StoryMapRepository } from "../ports/StoryMapRepository";

/** What came back: proposals, or the reason there were none to ask for. */
export type ProposalsResult = { readonly proposals: readonly ColumnProposal[]; readonly scenesRead: number } | { readonly needsReading: true };

/**
 * Asks the model which threads run through the book, from the events the
 * relation reading already stored per scene and the cast, so the pass is
 * one call over an outline rather than a read of every page. Without
 * readings there is nothing to ask about, and the result says so, so the
 * grid can offer the project reading first. Nothing is written here: the
 * writer picks which proposals become headings.
 */
export class ProposeColumns {
  constructor(private readonly repo: StoryMapRepository, private readonly analyser: ColumnAnalyser) {}

  async execute(project: ProjectSpec, grid: PlotGrid, graph: StoryGraph, signal: AbortSignal): Promise<ProposalsResult> {
    const file = await this.repo.load(project);
    const brief = briefOf(file, grid, graph);
    if (!brief.scenes.some((s) => s.events.length)) return { needsReading: true };
    const raw = await this.analyser.propose(brief, signal);
    return { proposals: validateProposals(raw, brief), scenesRead: brief.scenes.filter((s) => s.events.length).length };
  }
}

export function briefOf(file: StoryMapFile, grid: PlotGrid, graph: StoryGraph): ProposalBrief {
  const events = new Map(file.readings.map((r) => [sceneKey(r.scene), r.events.map((e) => e.summary)]));
  const scenes = grid.rows.map((row) => ({ title: row.scene.title || "(opening)", events: events.get(sceneKey(row.scene)) ?? [] }));
  const cast = graph.entities.filter((e) => e.appearances.length > 0 && e.kind !== "note" && e.kind !== "reference" && e.kind !== "candidate").map((e) => ({ name: e.name, kind: e.kind }));
  return { scenes, cast, existing: grid.columns.map((c) => c.heading.heading) };
}
