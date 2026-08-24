import type { ProjectSpec } from "../../domain/progress/Project";

/** The writer's `Story threads.md` for a project, as markdown — the domain parses and edits it. */
export interface StoryThreadsRepository {
  /** The note's text, or "" when there is none yet. */
  load(project: ProjectSpec): Promise<string>;
  /** Read, change, write — creating the note (with its front matter) the first time. Returns the text written. */
  update(project: ProjectSpec, change: (markdown: string) => string): Promise<string>;
}
