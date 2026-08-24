import type { ProjectSpec } from "../../domain/progress/Project";
import { sceneKey, textHash } from "../../domain/story/StoryGraph";
import { dismissContradiction, undismissContradiction } from "../../domain/story/StoryMapFile";
import { buildThreads, DEFAULT_THREADS_OPTIONS, type BuildThreadsOptions } from "../../domain/threads/BuildThreads";
import { parseStoryThreads } from "../../domain/threads/StoryThreadsNote";
import type { ThreadModel } from "../../domain/threads/Thread";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import type { StoryThreadsRepository } from "../ports/StoryThreadsRepository";
import type { BuildStoryMap } from "./BuildStoryMap";

/**
 * The threads model for a project: the graph for the axis and the
 * entity threads, the story map note for facts and dismissals, the
 * writer's note for hand-drawn threads. Rebuilt on every refresh, like
 * the map — it is a pure function of the vault.
 */
export class BuildStoryThreads {
  constructor(
    private readonly map: BuildStoryMap,
    private readonly notes: ProjectNotes,
    private readonly storyRepo: StoryMapRepository,
    private readonly threadsRepo: StoryThreadsRepository,
    private readonly options: BuildThreadsOptions = DEFAULT_THREADS_OPTIONS,
  ) {}

  async execute(project: ProjectSpec): Promise<ThreadModel> {
    const [notes, file, markdown] = await Promise.all([this.notes.notes(project), this.storyRepo.load(project), this.threadsRepo.load(project)]);
    const graph = this.map.graphFrom(project, notes, file);
    // The graph carries no prose, so which fact readings have gone stale is worked out here.
    const hashes = new Map<string, string>();
    for (const n of notes) for (const s of n.scenes) hashes.set(sceneKey({ path: n.path, title: s.title, line: s.line }), textHash(s.prose));
    const stale = new Set<string>();
    for (const r of file.facts) {
      const key = sceneKey(r.scene);
      const current = hashes.get(key);
      if (current !== undefined && current !== r.hash) stale.add(key);
    }
    return buildThreads(graph, file, parseStoryThreads(markdown), stale, this.options);
  }

  async dismiss(project: ProjectSpec, key: string): Promise<void> {
    await this.storyRepo.update(project, (f) => dismissContradiction(f, key));
  }

  async undismiss(project: ProjectSpec, key: string): Promise<void> {
    await this.storyRepo.update(project, (f) => undismissContradiction(f, key));
  }
}
