import type { ProjectSpec } from "../../domain/progress/Project";
import type { StoryMapFile } from "../../domain/story/StoryMapFile";

/** The model readings and hand-placed layout of one project — a note in its folder, so it syncs with the project. */
export interface StoryMapRepository {
  load(project: ProjectSpec): Promise<StoryMapFile>;
  save(project: ProjectSpec, file: StoryMapFile): Promise<void>;
  /** Read, change, write — so a layout save during a long model run does not lose readings, nor the reverse. */
  update(project: ProjectSpec, change: (file: StoryMapFile) => StoryMapFile): Promise<StoryMapFile>;
}
