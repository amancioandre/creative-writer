import type { ProjectSpec } from "../../domain/progress/Project";
import { buildStoryGraph, type BuildOptions, DEFAULT_BUILD_OPTIONS, type ProjectNote } from "../../domain/story/BuildGraph";
import { normalise } from "../../domain/story/EntityIndex";
import type { StoryGraph } from "../../domain/story/StoryGraph";
import type { StoryMapFile } from "../../domain/story/StoryMapFile";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { StoryMapRepository } from "../ports/StoryMapRepository";

/** Reads a project and builds its graph. Cheap enough to redo on every refresh — tens of notes, milliseconds. */
export class BuildStoryMap {
  constructor(private readonly notes: ProjectNotes, private readonly repo: StoryMapRepository, private readonly options: BuildOptions = DEFAULT_BUILD_OPTIONS) {}

  projects(): ProjectSpec[] {
    return this.notes.projects();
  }

  /** The project a note belongs to — the narrowest scope that contains it. */
  projectFor(path: string): ProjectSpec | null {
    const inScope = (s: ProjectSpec) => (s.scope.endsWith("/") || s.scope === "" ? path.startsWith(s.scope) : path === s.scope);
    return this.notes.projects().filter(inScope).sort((a, b) => b.scope.length - a.scope.length)[0] ?? null;
  }

  async execute(project: ProjectSpec): Promise<StoryGraph> {
    const [notes, file] = await Promise.all([this.notes.notes(project), this.repo.load(project)]);
    return this.graphFrom(project, notes, file);
  }

  /** The graph from notes and a file already in hand — for callers that need the notes for something else as well. */
  graphFrom(project: ProjectSpec, notes: readonly ProjectNote[], file: StoryMapFile): StoryGraph {
    return buildStoryGraph(project.name, notes, file, { ...this.options, ignore: new Set(project.ignoredNames.map(normalise)) });
  }
}
