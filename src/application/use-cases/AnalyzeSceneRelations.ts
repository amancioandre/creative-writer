import type { ProjectSpec } from "../../domain/progress/Project";
import { EntityIndex } from "../../domain/story/EntityIndex";
import { findMentions } from "../../domain/story/Mentions";
import { validateReading } from "../../domain/story/SceneReading";
import { sceneKey, textHash, type SceneRef, type StoryGraph } from "../../domain/story/StoryGraph";
import { putReading, type SceneReading } from "../../domain/story/StoryMapFile";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { RelationAnalyser } from "../ports/RelationAnalyser";
import type { StoryMapRepository } from "../ports/StoryMapRepository";

const MIN_WORDS = 40;

export interface AnalyzeProgress {
  readonly done: number;
  readonly total: number;
  readonly scene: SceneRef;
  readonly skipped: boolean;
}

/**
 * Runs the model over a note's scenes, one at a time, and stores what
 * survives validation. Scenes whose text has not changed since their
 * last reading are skipped, so re-running after an edit costs one scene,
 * not a chapter. The result is saved after every scene so an abort loses
 * nothing.
 */
export class AnalyzeSceneRelations {
  constructor(private readonly notes: ProjectNotes, private readonly repo: StoryMapRepository, private readonly analyser: RelationAnalyser) {}

  /**
   * Reads one note's scenes, or every scene note of the project when
   * `notePath` is null. Scene notes are the ones on the graph's timeline —
   * entity notes and the story map note itself are never read.
   */
  async execute(project: ProjectSpec, notePath: string | null, graph: StoryGraph, signal: AbortSignal, onProgress?: (p: AnalyzeProgress) => void, force = false): Promise<number> {
    const notes = await this.notes.notes(project);
    const sceneNotes = new Set(graph.timeline.map((t) => t.scene.path));
    const targets = notes.filter((n) => (notePath ? n.path === notePath : sceneNotes.has(n.path)));
    if (targets.length === 0) return 0;
    const index = new EntityIndex(notes);
    // Names the model may use: everything the graph knows, so candidates and aliases count.
    const known = graph.entities.filter((e) => e.kind !== "note" && e.kind !== "reference");
    const byId = new Map(known.map((e) => [e.id, e.name]));
    let file = await this.repo.load(project);
    const scenes = targets.flatMap((note) => note.scenes.filter((s) => s.prose.split(/\s+/).filter(Boolean).length >= MIN_WORDS).map((scene) => ({ note, scene })));
    let analysed = 0;
    for (let i = 0; i < scenes.length; i++) {
      const { note, scene } = scenes[i]!;
      const ref: SceneRef = { path: note.path, title: scene.title, line: scene.line };
      const hash = textHash(scene.prose);
      const existing = file.readings.find((r) => sceneKey(r.scene) === sceneKey(ref));
      if (!force && existing && existing.hash === hash) {
        onProgress?.({ done: i + 1, total: scenes.length, scene: ref, skipped: true });
        continue;
      }
      const row = graph.timeline.find((t) => sceneKey(t.scene) === sceneKey(ref));
      const present = row ? row.present.map((id) => byId.get(id)).filter((n): n is string => !!n) : [];
      if (present.length === 0) for (const m of findMentions(scene.prose, index)) if (m.entityId && byId.has(m.entityId)) present.push(byId.get(m.entityId)!);
      if (signal.aborted) break;
      const names = [...new Set(present)].sort((a, b) => a.localeCompare(b));
      const raw = await this.analyser.analyse(scene.prose, names, signal);
      const valid = validateReading(raw, scene.prose, names);
      const reading: SceneReading = { scene: ref, hash, model: this.analyser.name, ...valid };
      file = putReading(file, reading);
      await this.repo.save(project, file);
      analysed++;
      onProgress?.({ done: i + 1, total: scenes.length, scene: ref, skipped: false });
    }
    return analysed;
  }
}
