import { lastWorkedOn, type ProjectSpec } from "../../domain/progress/Project";
import type { WritingLog } from "../../domain/progress/WritingLog";
import { entityKindOf } from "../../domain/story/EntityIndex";
import { countWords } from "../../domain/text/Dialogue";
import type { Board } from "../../domain/writer/Board";
import { type StoriesRow, type StoryCard, ideasOf, linkTarget, storyCard } from "../../domain/writer/Stories";
import { type Story, usesOf } from "../../domain/writer/Uses";
import type { ProjectNote } from "../../domain/story/BuildGraph";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { WriterVault } from "../ports/WriterVault";

/**
 * The stories row: one card per declared project, built from the same notes
 * the story map reads, the writing log for the last day worked, and the
 * project note's front matter for stage, premise, idea and voice. Plus the
 * ideas with no home yet and the folders under the stories folder that
 * hold prose but declare nothing.
 */
export class BuildWriterStories {
  constructor(
    private readonly projects: ProjectNotes,
    private readonly vault: WriterVault,
    private readonly log: () => WritingLog,
    private readonly storiesFolder: () => string,
  ) {}

  async execute(board: Board): Promise<StoriesRow> {
    const specs = this.projects.projects();
    const stories: StoryCard[] = [];
    const read: Story[] = [];
    for (const spec of specs) {
      const notes = await this.projects.notes(spec);
      stories.push(storyCard(this.facts(spec, notes)));
      read.push({ name: spec.name, notes: notes.map((n) => ({ path: n.path, links: n.links, text: n.text ?? "" })) });
    }
    stories.sort((a, b) => (b.lastWorked ?? "").localeCompare(a.lastWorked ?? "") || a.spec.name.localeCompare(b.spec.name));
    const uses = usesOf(board.cards.map((c) => c.path), read, (link, from) => this.vault.resolve(link, from));
    return { stories, ideas: ideasOf(board, stories), unfiled: await this.unfiled(specs), uses };
  }

  private facts(spec: ProjectSpec, notes: readonly ProjectNote[]) {
    let words = 0, cast = 0, hasProse = false;
    for (const n of notes) {
      words += countWords(n.text ?? "");
      const kind = entityKindOf(n);
      if (kind === "character") cast++;
      if (kind === "note" && n.scenes.some((s) => s.prose.trim().length > 0)) hasProse = true;
    }
    const fm = this.vault.frontmatter(spec.notePath) ?? {};
    const linked = (key: string) => { const t = linkTarget(fm[key]); return t ? this.vault.resolve(t, spec.notePath) : null; };
    return { spec, frontmatter: fm, words, hasProse, cast, lastWorked: lastWorkedOn(this.log(), spec), idea: linked("writing-idea"), voice: linked("writing-voice") };
  }

  /** Folders directly under the stories folder that no project declares and that hold prose. Nothing without a stories folder. */
  private async unfiled(specs: readonly ProjectSpec[]): Promise<string[]> {
    const root = this.storiesFolder();
    if (!root) return [];
    const prefix = `${root}/`;
    const folders = new Set<string>();
    for (const p of this.vault.paths()) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash > 0) folders.add(prefix + rest.slice(0, slash));
    }
    const out: string[] = [];
    for (const folder of [...folders].sort()) {
      if (specs.some((s) => s.scope === `${folder}/` || s.scope.startsWith(`${folder}/`) || s.notePath.startsWith(`${folder}/`))) continue;
      if (await this.vault.folderHasProse(folder)) out.push(folder);
    }
    return out;
  }
}
