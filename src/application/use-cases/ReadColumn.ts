import type { ProjectSpec } from "../../domain/progress/Project";
import { EntityIndex } from "../../domain/story/EntityIndex";
import { sceneKey, textHash, type SceneRef, type StoryGraph } from "../../domain/story/StoryGraph";
import { putGridReading, type GridReading } from "../../domain/story/StoryMapFile";
import { validateCheck, validateGridReading } from "../../domain/plot/Readings";
import type { GridColumn } from "../../domain/plot/PlotGrid";
import { readScale } from "../../domain/plot/Gauge";
import type { ColumnAnalyser, ColumnBrief } from "../ports/ColumnAnalyser";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import type { AnalyzeProgress } from "./AnalyzeSceneRelations";

/** A scene this short can still hold a plant; the relation reading's forty is for a scene worth mapping. */
export const MIN_CELL_WORDS = 15;
import { presentNames } from "./presentNames";

/**
 * Reads one column of the plot grid with the model, one scene at a time:
 * every scene with prose and no stop in the column is shown to the model
 * with the column's brief, and what survives validation is saved to
 * `Story map.md` as a reading the writer will answer. Never a stop. A
 * scene is skipped when its prose is unchanged since it was last read for
 * this column with this prompt, or when the writer dismissed that reading;
 * the file is saved after every scene so an abort loses nothing.
 *
 * `check` is the same loop over the column's plans — stops with no
 * anchor — asking whether each is on the page; a found plan gets a
 * reading whose quote the writer may attach, a missing one a reading that
 * says so.
 */
export class ReadColumn {
  constructor(private readonly notes: ProjectNotes, private readonly repo: StoryMapRepository, private readonly analyser: ColumnAnalyser) {}

  async execute(project: ProjectSpec, column: GridColumn, graph: StoryGraph, signal: AbortSignal, onProgress?: (p: AnalyzeProgress) => void, force = false): Promise<number> {
    const notes = await this.notes.notes(project);
    const index = new EntityIndex(notes);
    let file = await this.repo.load(project);
    const brief = briefOf(column);
    const targets = this.scenes(notes, graph, column, (cell) => !cell.stop);
    let read = 0;
    for (let i = 0; i < targets.length; i++) {
      const { ref, prose, hash } = targets[i]!;
      const existing = file.grid.find((r) => sceneKey(r.scene) === sceneKey(ref) && r.column === column.heading.heading);
      if (!force && existing && existing.hash === hash && existing.rulebook === this.analyser.rulebook && existing.kind === "reading") {
        onProgress?.({ done: i + 1, total: targets.length, scene: ref, skipped: true });
        continue;
      }
      if (signal.aborted) break;
      const names = presentNames(graph, ref, prose, index);
      const raw = await this.analyser.read(prose, names, brief, signal);
      const valid = validateGridReading(raw, prose, column.heading.kind, brief.scale ?? []);
      const reading: GridReading = { scene: ref, hash, column: column.heading.heading, model: this.analyser.name, rulebook: this.analyser.rulebook, kind: "reading", text: valid?.text ?? "", role: valid?.role ?? null, keyword: valid?.keyword ?? null, evidence: valid?.evidence ?? "", state: valid ? "open" : "none" };
      file = await this.repo.update(project, (latest) => putGridReading(latest, reading));
      read++;
      onProgress?.({ done: i + 1, total: targets.length, scene: ref, skipped: false });
    }
    return read;
  }

  async check(project: ProjectSpec, column: GridColumn, graph: StoryGraph, signal: AbortSignal, onProgress?: (p: AnalyzeProgress) => void): Promise<number> {
    const notes = await this.notes.notes(project);
    const brief = briefOf(column);
    const targets = this.scenes(notes, graph, column, (cell) => !!cell.stop && cell.state === "plan");
    let checked = 0;
    for (let i = 0; i < targets.length; i++) {
      const { ref, prose, hash, cell } = targets[i]!;
      if (signal.aborted) break;
      const stop = cell.stop!;
      const raw = await this.analyser.check(prose, { note: stop.note, role: stop.role && stop.role !== "touch" ? stop.role : null }, brief, signal);
      const verdict = validateCheck(raw, prose);
      const reading: GridReading = { scene: ref, hash, column: column.heading.heading, model: this.analyser.name, rulebook: this.analyser.rulebook, kind: "check", text: verdict.found ? stop.note : "not on the page", role: null, keyword: null, evidence: verdict.evidence, state: "open" };
      await this.repo.update(project, (latest) => putGridReading(latest, reading));
      checked++;
      onProgress?.({ done: i + 1, total: targets.length, scene: ref, skipped: false });
    }
    return checked;
  }

  /** The column's rows that have prose enough to read, with the cell each holds, filtered by what the pass is for. */
  private scenes(notes: Awaited<ReturnType<ProjectNotes["notes"]>>, graph: StoryGraph, column: GridColumn, keep: (cell: GridColumn["cells"][number]) => boolean) {
    const byKey = new Map<string, string>();
    for (const n of notes) for (const s of n.scenes) byKey.set(sceneKey({ path: n.path, title: s.title, line: s.line }), s.prose);
    const out: { ref: SceneRef; prose: string; hash: string; cell: GridColumn["cells"][number] }[] = [];
    graph.headings?.forEach((ref) => {
      const prose = byKey.get(sceneKey(ref)) ?? "";
      if (prose.split(/\s+/).filter(Boolean).length < MIN_CELL_WORDS) return;
      const i = column.rowIndex.get(sceneKey(ref));
      const row = i === undefined ? undefined : column.cells[i];
      if (!row || !keep(row)) return;
      out.push({ ref, prose, hash: textHash(prose), cell: row });
    });
    return out;
  }
}

function briefOf(column: GridColumn): ColumnBrief {
  const examples = column.thread.refs.map((r) => `${r.keyword ? `${r.keyword}: ` : ""}${r.note}`).filter((n) => n.trim()).slice(0, 6);
  const scale = readScale(column.scale);
  return { name: column.heading.name, kind: column.heading.kind, examples, ...(column.entity ? { character: column.entity.name } : {}), ...(scale ? { scale: scale.words } : {}) };
}
