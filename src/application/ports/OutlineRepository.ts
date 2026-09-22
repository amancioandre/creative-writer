import type { ProjectSpec } from "../../domain/progress/Project";

/** The project's `Outline.md`, the plot grid's plan before the chapters exist, as markdown the domain parses and edits. */
export interface OutlineRepository {
  /** Where the note is, or would be. */
  pathFor(project: ProjectSpec): string;
  /** The note's text, or "" when there is none yet. */
  load(project: ProjectSpec): Promise<string>;
  /** Read, change, write, creating the note with its front matter the first time. Returns the text before and after, so a change can be undone exactly. */
  update(project: ProjectSpec, change: (markdown: string) => string): Promise<{ before: string; after: string }>;
}
