import type { ProjectSpec } from "../../domain/progress/Project";
import { BUILT_IN_TEMPLATES } from "../../domain/plot/BuiltInTemplates";
import { appendOutline, parseOutline } from "../../domain/plot/Outline";
import { parseTemplate, planApply, serializeTemplate, type ApplyChoices, type ApplyPlan, type StoryTemplate } from "../../domain/plot/Templates";
import { addThread, appendThreadItems, parseStoryThreads } from "../../domain/threads/StoryThreadsNote";
import type { OutlineRepository } from "../ports/OutlineRepository";
import type { StoryThreadsRepository } from "../ports/StoryThreadsRepository";
import type { TemplateRepository } from "../ports/TemplateRepository";

/** The project note's `plot-time`, `plot-pov` and `plot-theme`, read from the spec and written through the host. */
export interface ProjectKeys {
  set(project: ProjectSpec, key: "plot-pov" | "plot-time" | "plot-theme" | "plot-beats", value: string | null): Promise<void>;
}

export interface ApplyResult {
  readonly plan: ApplyPlan;
  /** Headings written; those the note already had are not here. */
  readonly added: readonly string[];
  /** Stops written to the plot point column, one per scene the template tags with a beat. */
  readonly beatStops: number;
  undo(): Promise<void>;
}

/**
 * Templates for the grid: the built-ins and the writer's own listed
 * together, one applied as headings to the threads note and the outline
 * with the jobs set on the project note, the current grid saved as a new
 * template note. Applying is deterministic and undone exactly.
 */
export class ApplyTemplate {
  constructor(private readonly templates: TemplateRepository, private readonly threads: StoryThreadsRepository, private readonly outline: OutlineRepository, private readonly keys: ProjectKeys) {}

  /** Built-ins first, then the writer's, by name. */
  async list(): Promise<readonly StoryTemplate[]> {
    const own = (await this.templates.list()).map((t) => parseTemplate(t.markdown, t.name, t.path));
    return [...BUILT_IN_TEMPLATES, ...own];
  }

  /** What applying would write, for the sheet. */
  async plan(project: ProjectSpec, template: StoryTemplate, choices: ApplyChoices, cast: readonly { name: string; kind: string; path: string | null }[]): Promise<ApplyPlan> {
    const existing = parseStoryThreads(await this.threads.load(project)).map((t) => t.name);
    return planApply(template, choices, { existing, cast });
  }

  async execute(project: ProjectSpec, plan: ApplyPlan): Promise<ApplyResult> {
    const added: string[] = [];
    let threadsBefore = "";
    let beatStops = 0;
    // The plot point column, when the template names one or the project already has it, takes one stop per tagged scene: the beat, in the template's own words.
    const beatsColumn = plan.jobs.beats ?? project.plotBeats ?? null;
    const outlineName = basename(this.outline.pathFor(project));
    const tagged = plan.structure ? parseOutline(plan.structure).acts.flatMap((a) => a.chapters.flatMap((c) => c.scenes)).filter((s) => s.beats.length) : [];
    await this.threads.update(project, (md) => {
      threadsBefore = md;
      let next = md;
      for (const h of plan.headings) { const after = addThread(next, h); if (after !== next) added.push(h); next = after; }
      if (beatsColumn && tagged.length && (added.includes(beatsColumn) || parseStoryThreads(next).some((t) => t.name.toLowerCase() === beatsColumn.toLowerCase()))) {
        next = appendThreadItems(next, beatsColumn, tagged.map((s) => ({ link: `${outlineName}#${s.title}`, note: s.beats.join(" · ") })));
        beatStops = tagged.length;
      }
      return next;
    });
    const outlined = plan.structure ? await this.outline.update(project, (md) => appendOutline(md, plan.structure!)) : null;
    const before = { time: project.plotTime ?? null, pov: project.plotPov ?? null, theme: project.plotTheme ?? null, beats: project.plotBeats ?? null };
    if (plan.jobs.time) await this.keys.set(project, "plot-time", plan.jobs.time);
    if (plan.jobs.pov) await this.keys.set(project, "plot-pov", plan.jobs.pov);
    if (plan.jobs.theme) await this.keys.set(project, "plot-theme", plan.jobs.theme);
    if (plan.jobs.beats) await this.keys.set(project, "plot-beats", plan.jobs.beats);
    const { threads, outline, keys } = this;
    return {
      plan, added, beatStops,
      // The threads note goes back whole: what the apply wrote is exactly what comes out, stops included.
      async undo() {
        await threads.update(project, () => threadsBefore);
        if (outlined) await outline.update(project, () => outlined.before);
        if (plan.jobs.time) await keys.set(project, "plot-time", before.time);
        if (plan.jobs.pov) await keys.set(project, "plot-pov", before.pov);
        if (plan.jobs.theme) await keys.set(project, "plot-theme", before.theme);
        if (plan.jobs.beats) await keys.set(project, "plot-beats", before.beats);
      },
    };
  }

  /** The grid as it stands, saved as a template note: its columns, their jobs, and the outline's structure. Resolves to the path. */
  async save(project: ProjectSpec, name: string, parts: { columns: boolean; rows: boolean }): Promise<string> {
    const columns = parts.columns ? parseStoryThreads(await this.threads.load(project)).map((t) => t.name) : [];
    const outlineText = parts.rows ? await this.outline.load(project) : "";
    const structure = outlineText ? bodyOf(outlineText) : "";
    const jobs = parts.columns ? { ...(project.plotTime ? { time: project.plotTime } : {}), ...(project.plotPov ? { pov: project.plotPov } : {}), ...(project.plotTheme ? { theme: project.plotTheme } : {}), ...(project.plotBeats ? { beats: project.plotBeats } : {}) } : {};
    if (!columns.length && !parseOutline(outlineText).scenes) throw new Error("There is nothing to save: no columns and no outline.");
    return this.templates.save(name, serializeTemplate(name, { columns, jobs, structure }));
  }
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

/** The outline's structure without its front matter and its line of explanation: the headings and their comments. */
function bodyOf(outlineText: string): string {
  const lines = outlineText.split("\n");
  let start = 0;
  if (lines[0] === "---") { const end = lines.indexOf("---", 1); if (end > 0) start = end + 1; }
  const body = lines.slice(start);
  const first = body.findIndex((l) => /^#{1,6}\s/.test(l));
  return first < 0 ? "" : body.slice(first).join("\n").trim();
}
