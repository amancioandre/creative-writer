import type { ProjectSpec } from "../../domain/progress/Project";
import { markBuilt, parseOutline } from "../../domain/plot/Outline";
import { planScaffold, scaffoldPaths, type ScaffoldPlan, type ScaffoldShape } from "../../domain/plot/Scaffold";
import { relinkThreadItems } from "../../domain/threads/StoryThreadsNote";
import type { OutlineRepository } from "../ports/OutlineRepository";
import type { StoryThreadsRepository } from "../ports/StoryThreadsRepository";

/** The vault as the build needs it: notes read and written by path, and, for undo, a note or an empty folder taken away. */
export interface ScaffoldVault {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Removes the folder when nothing is left in it; resolves to whether it did. */
  removeFolderIfEmpty(path: string): Promise<boolean>;
}

export interface ScaffoldResult {
  readonly plan: ScaffoldPlan;
  /** Stops in `Story threads.md` pointed at the new headings. */
  readonly relinked: number;
  readonly day: string;
  /** Takes the build back: notes it created and left untouched since are removed, appended notes and the threads and outline notes go back to their text before. */
  undo(): Promise<void>;
}

/**
 * Build the manuscript from the outline: the plan written to the vault,
 * the threads note relinked, the outline marked built. Reruns are safe:
 * a note that exists only gains the headings it lacks, and one that has
 * them all is left alone.
 */
export class ScaffoldManuscript {
  constructor(
    private readonly outline: OutlineRepository,
    private readonly threads: StoryThreadsRepository,
    private readonly vault: ScaffoldVault,
    private readonly today: () => string,
  ) {}

  /** What a build would write, for the sheet: nothing is touched. */
  async preview(project: ProjectSpec, shape: ScaffoldShape): Promise<ScaffoldPlan | null> {
    const markdown = await this.outline.load(project);
    if (!markdown.trim()) return null;
    const outline = parseOutline(markdown);
    const folder = projectFolder(project);
    const existing = new Map<string, string>();
    for (const path of scaffoldPaths(outline, folder, shape)) if (await this.vault.exists(path)) existing.set(path, await this.vault.read(path));
    return planScaffold(outline, { folder, shape, outlineName: basename(this.outline.pathFor(project)), existing: (p) => existing.get(p) ?? null });
  }

  async execute(project: ProjectSpec, shape: ScaffoldShape): Promise<ScaffoldResult> {
    const plan = await this.preview(project, shape);
    if (!plan) throw new Error("There is no outline to build from.");
    for (const file of plan.files) await this.vault.write(file.path, file.content);
    let relinked = 0;
    let threadsBefore = "";
    const threadsAfter = await this.threads.update(project, (md) => {
      threadsBefore = md;
      return plan.relinks.reduce((text, r) => { const out = relinkThreadItems(text, r.from, r.to); relinked += out.changed; return out.markdown; }, md);
    });
    const day = this.today();
    const outlined = await this.outline.update(project, (md) => markBuilt(md, day));
    const vault = this.vault, threads = this.threads, outline = this.outline;
    return {
      plan, relinked, day,
      async undo() {
        for (const file of [...plan.files].reverse()) {
          if (!(await vault.exists(file.path))) continue;
          const now = await vault.read(file.path);
          if (now !== file.content) continue; // the writer has been here since: theirs to keep
          if (file.before === null) await vault.remove(file.path); else await vault.write(file.path, file.before);
        }
        if (threadsAfter !== threadsBefore) await threads.update(project, () => threadsBefore);
        await outline.update(project, () => outlined.before);
        // Folders last, and each on its own: an empty folder left behind is untidy, a note not restored would be a loss.
        for (const dir of [...plan.folders].reverse()) await vault.removeFolderIfEmpty(dir).catch(() => false);
      },
    };
  }
}

function projectFolder(project: ProjectSpec): string {
  return project.scope.endsWith("/") || project.scope === "" ? project.scope : project.scope.slice(0, project.scope.lastIndexOf("/") + 1);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}
