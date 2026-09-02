import type { ProjectSpec } from "../../domain/progress/Project";
import { buildManuscript, type Manuscript, type ManuscriptOptions } from "../../domain/manuscript/Manuscript";
import type { ProjectNotes } from "../ports/ProjectNotes";

/** Reads a project and stitches its prose into one manuscript. Pure and cheap: rebuilt on every change. */
export class BuildManuscript {
  constructor(private readonly notes: ProjectNotes, private readonly options: () => ManuscriptOptions) {}

  async execute(project: ProjectSpec): Promise<Manuscript> {
    const notes = await this.notes.notes(project);
    return buildManuscript(project, notes.map((n) => ({ path: n.path, frontmatter: n.frontmatter, text: n.text ?? "" })), this.options());
  }
}
