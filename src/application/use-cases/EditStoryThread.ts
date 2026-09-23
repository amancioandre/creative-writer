import type { ProjectSpec } from "../../domain/progress/Project";
import { addThread, appendThreadItems, removeThread, removeThreadItem, renameScaleWord, renameThread, setStopRole, setThreadScale, upsertThreadItem } from "../../domain/threads/StoryThreadsNote";
import type { StopRole } from "../../domain/threads/Thread";

/** A stop to write: where, what it is, the sentence it hangs on, a word about it. */
export interface StopToAdd {
  readonly link: string;
  readonly note: string;
  readonly role?: StopRole;
  readonly quote?: string | null;
  /** A word of the thread's scale: what the scene mostly appears to be. Undefined keeps what the line has; null clears it. */
  readonly keyword?: string | null;
}
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

  /** Several stops on one thread at once: a plant and its reversal, or every occurrence of a motif. */
  async addStops(project: ProjectSpec, thread: string, stops: readonly StopToAdd[]): Promise<void> {
    if (!thread.trim() || stops.length === 0) return;
    await this.repo.update(project, (md) => appendThreadItems(md, thread, stops));
  }

  /** A contradiction the story means: the earlier scene becomes the plant, the later one the reversal, both anchored to the model's quotes. */
  async addReversal(project: ProjectSpec, thread: string, plant: { link: string; quote: string }, reversal: { link: string; quote: string }): Promise<void> {
    await this.addStops(project, thread, [{ link: plant.link, note: "", role: "plant", quote: plant.quote }, { link: reversal.link, note: "", role: "reversal", quote: reversal.quote }]);
  }

  async setRole(project: ProjectSpec, thread: string, link: string, role: StopRole): Promise<void> {
    await this.repo.update(project, (md) => setStopRole(md, thread, link, role));
  }

  async rename(project: ProjectSpec, from: string, to: string): Promise<void> {
    await this.repo.update(project, (md) => renameThread(md, from, to));
  }

  /** A thread with no stops: an empty column of the plot grid. */
  async addThread(project: ProjectSpec, name: string): Promise<void> {
    if (!name.trim()) return;
    await this.repo.update(project, (md) => addThread(md, name));
  }

  /** The heading and every stop under it. */
  async removeThread(project: ProjectSpec, name: string): Promise<void> {
    await this.repo.update(project, (md) => removeThread(md, name));
  }

  /** The thread's scale as one comment line under its heading; null takes the line out. */
  async setScale(project: ProjectSpec, thread: string, words: readonly string[] | null): Promise<void> {
    await this.repo.update(project, (md) => setThreadScale(md, thread, words));
  }

  /** One word of the scale renamed, in the scale line and in every stop that used it. Resolves to how many stops changed. */
  async renameScaleWord(project: ProjectSpec, thread: string, from: string, to: string): Promise<number> {
    let changed = 0;
    await this.repo.update(project, (md) => { const r = renameScaleWord(md, thread, from, to); changed = r.changed; return r.markdown; });
    return changed;
  }
}
