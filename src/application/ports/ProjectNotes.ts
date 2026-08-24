import type { ProjectNote } from "../../domain/story/BuildGraph";
import type { ProjectSpec } from "../../domain/progress/Project";

/** Reads every note in a project's scope, parsed for the story map. */
export interface ProjectNotes {
  /** All projects declared in front matter, name-sorted. */
  projects(): ProjectSpec[];
  notes(project: ProjectSpec): Promise<ProjectNote[]>;
}
