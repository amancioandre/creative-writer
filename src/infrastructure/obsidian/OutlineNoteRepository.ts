import type { OutlineRepository } from "../../application/ports/OutlineRepository";
import type { ProjectSpec } from "../../domain/progress/Project";
import { OUTLINE_NOTE, serializeOutlineNote } from "../../domain/plot/Outline";
import { projectFolder, type NoteVaultLike } from "./StoryMapNoteRepository";

/**
 * `Outline.md` beside `Story threads.md`: the writer's plan, handed over
 * whole and written back as the domain's line edits leave it. Created on
 * the first row with front matter that keeps it out of the map and the
 * editor features.
 */
export class OutlineNoteRepository implements OutlineRepository {
  constructor(private readonly vault: NoteVaultLike) {}

  pathFor(project: ProjectSpec): string {
    return `${projectFolder(project)}${OUTLINE_NOTE}`;
  }

  async load(project: ProjectSpec): Promise<string> {
    const path = this.pathFor(project);
    if (!(await this.vault.exists(path))) return "";
    try {
      return await this.vault.read(path);
    } catch {
      return "";
    }
  }

  private queue: Promise<unknown> = Promise.resolve();

  /** Serialised, so two quick row actions cannot interleave their read and write. */
  update(project: ProjectSpec, change: (markdown: string) => string): Promise<{ before: string; after: string }> {
    const run = this.queue.then(async () => {
      const path = this.pathFor(project);
      const exists = await this.vault.exists(path);
      const before = exists ? await this.vault.read(path) : "";
      // An undo of the first row leaves the note blank; the next row starts it afresh, front matter and all.
      const after = change(before.trim() ? before : serializeOutlineNote(project.name));
      if (!exists || after !== before) await this.vault.write(path, after);
      return { before, after };
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
