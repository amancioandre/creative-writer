import type { WritingLog } from "../../domain/progress/WritingLog";

/** Persists the writing log. Lives beside the plugin's settings but in its own file: history is not configuration. */
export interface ProgressRepository {
  load(): Promise<WritingLog>;
  save(log: WritingLog): Promise<void>;
}
