import type { StoryMapRepository } from "../../application/ports/StoryMapRepository";
import type { ProjectSpec } from "../../domain/progress/Project";
import { EMPTY_STORY_MAP_FILE, STORY_MAP_NOTE, parseStoryMapNote, serializeStoryMapNote, type StoryMapFile } from "../../domain/story/StoryMapFile";

/** The vault operations needed, structurally typed for tests. */
export interface NoteVaultLike {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

/**
 * `Story map.md` in the project folder. A markdown note, not a JSON file,
 * because that is what every sync method — Obsidian Sync, git, Syncthing,
 * a shared drive — carries without being asked. It syncs with the
 * project, so the same readings show on the desktop and the laptop.
 */
export class StoryMapNoteRepository implements StoryMapRepository {
  constructor(private readonly vault: NoteVaultLike) {}

  static pathFor(project: ProjectSpec): string {
    const folder = project.scope.endsWith("/") || project.scope === "" ? project.scope : project.scope.slice(0, project.scope.lastIndexOf("/") + 1);
    return `${folder}${STORY_MAP_NOTE}`;
  }

  async load(project: ProjectSpec): Promise<StoryMapFile> {
    const path = StoryMapNoteRepository.pathFor(project);
    if (!(await this.vault.exists(path))) return EMPTY_STORY_MAP_FILE;
    try {
      return parseStoryMapNote(await this.vault.read(path));
    } catch {
      return EMPTY_STORY_MAP_FILE;
    }
  }

  async save(project: ProjectSpec, file: StoryMapFile): Promise<void> {
    await this.vault.write(StoryMapNoteRepository.pathFor(project), serializeStoryMapNote(file, project.name));
  }

  private queue: Promise<unknown> = Promise.resolve();

  /** Updates are serialised so two quick edits (a drag, then a reading) cannot interleave their read and write. */
  update(project: ProjectSpec, change: (file: StoryMapFile) => StoryMapFile): Promise<StoryMapFile> {
    const run = this.queue.then(async () => {
      const next = change(await this.load(project));
      await this.save(project, next);
      return next;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
