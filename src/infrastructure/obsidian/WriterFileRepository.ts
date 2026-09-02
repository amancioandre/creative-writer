import type { WriterRepository } from "../../application/ports/WriterRepository";
import { EMPTY_WRITER_FILE, WRITER_EXTENSION, WRITER_FILE_NAME, type WriterFile, parseWriterFile, serializeWriterFile } from "../../domain/writer/WriterFile";
import type { NoteVaultLike } from "./StoryMapNoteRepository";

/** The vault operations needed, structurally typed for tests. `paths` lists every file in the vault, any extension. */
export interface WriterVaultLike extends NoteVaultLike {
  paths(): string[];
}

/**
 * The vault's one `.writer` file, found by extension, so there is no path
 * setting and no folder. When none exists the first save creates
 * `Writer.writer` in the default folder (the stories folder when one is
 * set, else the vault root).
 */
export class WriterFileRepository implements WriterRepository {
  constructor(private readonly vault: WriterVaultLike, private readonly defaultFolder: () => string = () => "") {}

  path(): string | null {
    const suffix = `.${WRITER_EXTENSION}`;
    return this.vault.paths().filter((p) => p.toLowerCase().endsWith(suffix)).sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? null;
  }

  /** Where a new file goes. */
  defaultPath(): string {
    const folder = this.defaultFolder().replace(/^\/+|\/+$/g, "");
    return folder ? `${folder}/${WRITER_FILE_NAME}` : WRITER_FILE_NAME;
  }

  async load(): Promise<WriterFile> {
    const path = this.path();
    if (!path || !(await this.vault.exists(path))) return EMPTY_WRITER_FILE;
    try {
      return parseWriterFile(await this.vault.read(path));
    } catch {
      return EMPTY_WRITER_FILE;
    }
  }

  async save(file: WriterFile): Promise<void> {
    await this.vault.write(this.path() ?? this.defaultPath(), serializeWriterFile(file));
  }

  private queue: Promise<unknown> = Promise.resolve();

  update(change: (file: WriterFile) => WriterFile): Promise<WriterFile> {
    const run = this.queue.then(async () => {
      const next = change(await this.load());
      await this.save(next);
      return next;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
