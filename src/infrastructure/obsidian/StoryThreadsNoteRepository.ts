import type { StoryThreadsRepository } from "../../application/ports/StoryThreadsRepository";
import type { ProjectSpec } from "../../domain/progress/Project";
import { STORY_THREADS_NOTE, serializeStoryThreadsNote } from "../../domain/threads/StoryThreadsNote";
import { projectFolder, type NoteVaultLike } from "./StoryMapNoteRepository";

/**
 * `Story threads.md` beside `Story map.md`. Unlike the map note this one is
 * the writer's own prose — the repository hands the markdown over whole
 * and writes back whatever the domain's line edits return. Created on
 * the first write, with front matter that keeps the editor features off it.
 */
export class StoryThreadsNoteRepository implements StoryThreadsRepository {
  constructor(private readonly vault: NoteVaultLike) {}

  static pathFor(project: ProjectSpec): string {
    return `${projectFolder(project)}${STORY_THREADS_NOTE}`;
  }

  async load(project: ProjectSpec): Promise<string> {
    const path = StoryThreadsNoteRepository.pathFor(project);
    if (!(await this.vault.exists(path))) return "";
    try {
      return await this.vault.read(path);
    } catch {
      return "";
    }
  }

  private queue: Promise<unknown> = Promise.resolve();

  /** Serialised like the map note's updates, so two quick edits cannot interleave their read and write. */
  update(project: ProjectSpec, change: (markdown: string) => string): Promise<string> {
    const run = this.queue.then(async () => {
      const path = StoryThreadsNoteRepository.pathFor(project);
      const exists = await this.vault.exists(path);
      const before = exists ? await this.vault.read(path) : serializeStoryThreadsNote(project.name);
      const next = change(before);
      if (!exists || next !== before) await this.vault.write(path, next);
      return next;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
