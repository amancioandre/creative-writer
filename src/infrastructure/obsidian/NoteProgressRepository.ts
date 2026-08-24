import type { ProgressRepository } from "../../application/ports/ProgressRepository";
import { EMPTY_LOG, type WritingLog } from "../../domain/progress/WritingLog";
import { isLogEmpty, parseWritingLogNote, serializeWritingLogNote } from "../../domain/progress/WritingLogNote";
import type { NoteVaultLike } from "./StoryMapNoteRepository";

/**
 * The writing log in a vault note (see WritingLogNote). The path is read
 * on every call so a settings change takes effect at the next save. On
 * first load, if the note does not exist yet but a legacy repository
 * (progress.json in the plugin folder) has history, that history is
 * imported and written to the note; the legacy file is left alone.
 */
export class NoteProgressRepository implements ProgressRepository {
  constructor(private readonly vault: NoteVaultLike, private readonly path: () => string, private readonly legacy?: ProgressRepository) {}

  async load(): Promise<WritingLog> {
    const path = this.path();
    if (await this.vault.exists(path)) {
      try {
        return parseWritingLogNote(await this.vault.read(path));
      } catch {
        return EMPTY_LOG;
      }
    }
    const inherited = (await this.legacy?.load()) ?? EMPTY_LOG;
    if (!isLogEmpty(inherited)) await this.save(inherited);
    return inherited;
  }

  async save(log: WritingLog): Promise<void> {
    await this.vault.write(this.path(), serializeWritingLogNote(log));
  }
}
