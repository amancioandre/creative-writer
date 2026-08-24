import type { DataAdapter } from "obsidian";
import type { ProgressRepository } from "../../application/ports/ProgressRepository";
import { EMPTY_LOG, normalizeLog, type WritingLog } from "../../domain/progress/WritingLog";

/**
 * `progress.json` beside the plugin's `data.json`. Kept separate so the
 * settings file stays small and hand-editable, and so a settings reset does
 * not erase a year of history.
 */
export class AdapterProgressRepository implements ProgressRepository {
  constructor(private readonly adapter: DataAdapter, private readonly path: string) {}

  async load(): Promise<WritingLog> {
    if (!(await this.adapter.exists(this.path))) return EMPTY_LOG;
    try {
      return normalizeLog(JSON.parse(await this.adapter.read(this.path)));
    } catch {
      return EMPTY_LOG;
    }
  }

  async save(log: WritingLog): Promise<void> {
    await this.adapter.write(this.path, JSON.stringify(log));
  }
}
