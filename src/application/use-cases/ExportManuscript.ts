import type { ProjectSpec } from "../../domain/progress/Project";
import { buildManuscript, type Manuscript, type ManuscriptOptions } from "../../domain/manuscript/Manuscript";
import { exportNote } from "../../domain/manuscript/Export";
import type { ProjectNotes } from "../ports/ProjectNotes";

/** The slice of note storage an export needs: one write. */
export interface NoteWriter {
  write(path: string, content: string): Promise<void>;
}

/**
 * Writes the manuscript as one note beside the project: `<Name> (manuscript).md`
 * in the project folder, overwritten on every export. A snapshot the writer
 * can send on or delete; the flag in its front matter keeps it out of every
 * count and every view.
 */
export class ExportManuscript {
  constructor(private readonly notes: ProjectNotes, private readonly writer: NoteWriter, private readonly options: () => ManuscriptOptions) {}

  static pathFor(project: ProjectSpec): string {
    const folder = project.scope.endsWith("/") || project.scope === "" ? project.scope : project.scope.slice(0, project.scope.lastIndexOf("/") + 1);
    const safe = project.name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "Manuscript";
    return `${folder}${safe} (manuscript).md`;
  }

  async execute(project: ProjectSpec): Promise<{ path: string; manuscript: Manuscript }> {
    const notes = await this.notes.notes(project);
    const manuscript = buildManuscript(project, notes.map((n) => ({ path: n.path, frontmatter: n.frontmatter, text: n.text ?? "" })), this.options());
    const path = ExportManuscript.pathFor(project);
    await this.writer.write(path, exportNote(project.name, manuscript));
    return { path, manuscript };
  }
}
