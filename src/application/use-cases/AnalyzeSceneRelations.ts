import type { ProjectSpec } from "../../domain/progress/Project";
import { EntityIndex } from "../../domain/story/EntityIndex";
import { validateReading } from "../../domain/story/SceneReading";
import { sceneKey, textHash, type SceneRef, type StoryGraph } from "../../domain/story/StoryGraph";
import { putReading, type SceneReading } from "../../domain/story/StoryMapFile";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { RelationAnalyser } from "../ports/RelationAnalyser";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import { presentNames } from "./presentNames";

/** Shorter than this and a scene is a heading with a line under it — not worth a model call. */
export const MIN_SCENE_WORDS = 40;
const MIN_WORDS = MIN_SCENE_WORDS;

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
      if (signal.aborted) break;
      const names = presentNames(graph, ref, scene.prose, index);
      const raw = await this.analyser.analyse(scene.prose, names, signal);
      const valid = validateReading(raw, scene.prose, names);
      const reading: SceneReading = { scene: ref, hash, model: this.analyser.name, ...valid };
      file = await this.repo.update(project, (latest) => putReading(latest, reading));
      analysed++;
      onProgress?.({ done: i + 1, total: scenes.length, scene: ref, skipped: false });
    }
    return analysed;
  }
}
