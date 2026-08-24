import type { ProjectSpec } from "../../domain/progress/Project";
import { removeThreadItem, renameThread, upsertThreadItem } from "../../domain/threads/StoryThreadsNote";
import type { StoryThreadsRepository } from "../ports/StoryThreadsRepository";

/** Edits to the writer's `Story threads.md`, one line at a time. The view rebuilds afterwards; nothing is returned. */
export class EditStoryThread {
  constructor(private readonly repo: StoryThreadsRepository) {}

  /** Adds a scene to a thread (starting the thread if it is new), or changes the note on a scene already in it. */
  async addRef(project: ProjectSpec, thread: string, link: string, note: string): Promise<void> {
    if (!thread.trim() || !link.trim()) return;
    await this.repo.update(project, (md) => upsertThreadItem(md, thread, link, note));
  }

  async removeRef(project: ProjectSpec, thread: string, link: string): Promise<void> {
    await this.repo.update(project, (md) => removeThreadItem(md, thread, link));
  }

  async rename(project: ProjectSpec, from: string, to: string): Promise<void> {
    await this.repo.update(project, (md) => renameThread(md, from, to));
  }
}
