import type { ProjectSpec } from "../../domain/progress/Project";
import type { StoryMapFile } from "../../domain/story/StoryMapFile";

/** The model readings of one project — a note in its folder, so it syncs with the project. */
export interface StoryMapRepository {
  load(project: ProjectSpec): Promise<StoryMapFile>;
  save(project: ProjectSpec, file: StoryMapFile): Promise<void>;
}
