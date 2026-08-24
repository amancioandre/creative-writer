import type { ProjectSpec } from "../../domain/progress/Project";
import { EntityIndex } from "../../domain/story/EntityIndex";
import { sceneKey, textHash, type SceneRef, type StoryGraph } from "../../domain/story/StoryGraph";
import { putFactReading, type FactReading } from "../../domain/story/StoryMapFile";
import { validateFacts } from "../../domain/threads/Facts";
import type { FactAnalyser } from "../ports/FactAnalyser";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import { MIN_SCENE_WORDS, type AnalyzeProgress } from "./AnalyzeSceneRelations";
import { presentNames } from "./presentNames";

/**
 * Runs the fact-reading prompt over a note's scenes — or the project's —
 * one scene at a time, keeping what survives validation. Same shape as
 * the relation reading, and the same economy: a scene is skipped when its
 * prose is unchanged since it was last read *with this prompt*, and the
 * file is saved after every scene so an abort loses nothing.
 */
export class AnalyzeSceneFacts {
  constructor(private readonly notes: ProjectNotes, private readonly repo: StoryMapRepository, private readonly analyser: FactAnalyser) {}

  async execute(project: ProjectSpec, notePath: string | null, graph: StoryGraph, signal: AbortSignal, onProgress?: (p: AnalyzeProgress) => void, force = false): Promise<number> {
    const notes = await this.notes.notes(project);
    const sceneNotes = new Set(graph.timeline.map((t) => t.scene.path));
    const targets = notes.filter((n) => (notePath ? n.path === notePath : sceneNotes.has(n.path)));
    if (targets.length === 0) return 0;
    const index = new EntityIndex(notes);
    let file = await this.repo.load(project);
    const scenes = targets.flatMap((note) => note.scenes.filter((s) => s.prose.split(/\s+/).filter(Boolean).length >= MIN_SCENE_WORDS).map((scene) => ({ note, scene })));
    let analysed = 0;
    for (let i = 0; i < scenes.length; i++) {
      const { note, scene } = scenes[i]!;
      const ref: SceneRef = { path: note.path, title: scene.title, line: scene.line };
      const hash = textHash(scene.prose);
      const existing = file.facts.find((r) => sceneKey(r.scene) === sceneKey(ref));
      if (!force && existing && existing.hash === hash && existing.rulebook === this.analyser.rulebook) {
        onProgress?.({ done: i + 1, total: scenes.length, scene: ref, skipped: true });
        continue;
      }
      if (signal.aborted) break;
      const names = presentNames(graph, ref, scene.prose, index);
      const raw = await this.analyser.analyse(scene.prose, names, signal);
      const reading: FactReading = { scene: ref, hash, model: this.analyser.name, rulebook: this.analyser.rulebook, facts: validateFacts(raw, scene.prose, names) };
      file = await this.repo.update(project, (latest) => putFactReading(latest, reading));
      analysed++;
      onProgress?.({ done: i + 1, total: scenes.length, scene: ref, skipped: false });
    }
    return analysed;
  }
}
