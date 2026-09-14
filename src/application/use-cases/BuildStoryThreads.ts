import { EMPTY_ECHOES, echoOptions, findEchoes, type EchoScene, type Echoes } from "../../domain/echoes/Echoes";
import { semanticEchoPairs } from "../../domain/echoes/Semantic";
import type { ProjectSpec } from "../../domain/progress/Project";
import type { EchoSensitivity } from "../../domain/settings/Settings";
import { sceneKey, textHash, type StoryGraph } from "../../domain/story/StoryGraph";
import { dismissContradiction, undismissContradiction, type StoryMapFile } from "../../domain/story/StoryMapFile";
import { buildThreads, DEFAULT_THREADS_OPTIONS, type BuildThreadsOptions } from "../../domain/threads/BuildThreads";
import { parseStoryThreads } from "../../domain/threads/StoryThreadsNote";
import type { ThreadModel } from "../../domain/threads/Thread";
import type { ProjectNote } from "../../domain/story/BuildGraph";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { SentenceSegmenter } from "../ports/SentenceSegmenter";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import type { StoryThreadsRepository } from "../ports/StoryThreadsRepository";
import type { BuildStoryMap } from "./BuildStoryMap";

/** What the echo finder needs from the outside: sentences, and the writer's choice of how loud to be. */
export interface EchoSources {
  readonly segmenter: SentenceSegmenter;
  readonly sensitivity: () => EchoSensitivity;
}

/**
 * The threads model for a project: the graph for the axis and the
 * entity threads, the story map note for facts and dismissals, the
 * writer's note for hand-drawn threads, the echo finder for echoes.
 * Rebuilt on every refresh, like the map — it is a pure function of the
 * vault. The echoes are the one costly part, so they are kept in memory
 * by a hash of the prose and recomputed only when a scene changes.
 */
export class BuildStoryThreads {
  private echoCache: { key: string; echoes: Echoes } | null = null;

  constructor(
    private readonly map: BuildStoryMap,
    private readonly notes: ProjectNotes,
    private readonly storyRepo: StoryMapRepository,
    private readonly threadsRepo: StoryThreadsRepository,
    private readonly options: BuildThreadsOptions = DEFAULT_THREADS_OPTIONS,
    private readonly echoSources: EchoSources | null = null,
  ) {}

  async execute(project: ProjectSpec): Promise<ThreadModel> {
    return (await this.executeWithGraph(project)).model;
  }

  /** The model and the graph it was built on, for a view that needs both — the plot grid draws rows from one and columns from the other. */
  async executeWithGraph(project: ProjectSpec): Promise<{ graph: StoryGraph; model: ThreadModel; file: StoryMapFile; hashes: ReadonlyMap<string, string> }> {
    const [notes, file, markdown] = await Promise.all([this.notes.notes(project), this.storyRepo.load(project), this.threadsRepo.load(project)]);
    const graph = this.map.graphFrom(project, notes, file);
    const found = this.echoes(project, graph, notes);
    // The graph carries no prose, so which fact readings have gone stale is worked out here.
    const hashes = new Map<string, string>();
    for (const n of notes) for (const s of n.scenes) hashes.set(sceneKey({ path: n.path, title: s.title, line: s.line }), textHash(s.prose));
    const stale = new Set<string>();
    for (const r of file.facts) {
      const key = sceneKey(r.scene);
      const current = hashes.get(key);
      if (current !== undefined && current !== r.hash) stale.add(key);
    }
    const textOf = (path: string) => notes.find((n) => n.path === path)?.text;
    // The semantic tier's stored pairs join the offline ones, minus any that duplicate them and any whose scene moved on.
    const sceneIndex = new Map(graph.timeline.map((row, i) => [sceneKey(row.scene), i]));
    const semantic = semanticEchoPairs(file.echoes, sceneIndex, hashes, echoOptions(this.echoSources?.sensitivity() ?? "medium"));
    const said = new Set(found.pairs.map((p) => `${p.a.sentence}|${p.b.sentence}`));
    const echoes: Echoes = { groups: found.groups, pairs: [...found.pairs, ...semantic.pairs.filter((p) => !said.has(`${p.a.sentence}|${p.b.sentence}`))] };
    return { graph, model: buildThreads(graph, file, parseStoryThreads(markdown), stale, this.options, textOf, echoes, { stored: file.echoes.length, stale: semantic.stale }), file, hashes };
  }

  /** The echo finder over the project's scenes in manuscript order, names excluded, cached by the prose. */
  private echoes(project: ProjectSpec, graph: StoryGraph, notes: readonly ProjectNote[]): Echoes {
    const src = this.echoSources;
    if (!src) return EMPTY_ECHOES;
    const byNote = new Map(notes.map((n) => [n.path, n]));
    const scenes: EchoScene[] = [];
    graph.timeline.forEach((row, index) => {
      const scene = byNote.get(row.scene.path)?.scenes.find((s) => s.line === row.scene.line && s.title === row.scene.title);
      if (!scene || !scene.prose.trim()) return;
      scenes.push({ ref: row.scene, index, prose: scene.prose, sentences: src.segmenter.segment(scene.prose) });
    });
    const sensitivity = src.sensitivity();
    const key = `${project.scope}|${sensitivity}|${textHash(scenes.map((s) => `${sceneKey(s.ref)}\n${s.prose}`).join("\u0000"))}`;
    if (this.echoCache?.key === key) return this.echoCache.echoes;
    const names = new Set<string>();
    for (const e of graph.entities) for (const n of [e.name, ...e.aliases]) for (const w of n.toLowerCase().split(/[\s'’-]+/)) if (w.length >= 2) names.add(w);
    const echoes = findEchoes(scenes, echoOptions(sensitivity, names));
    this.echoCache = { key, echoes };
    return echoes;
  }

  async dismiss(project: ProjectSpec, key: string): Promise<void> {
    await this.storyRepo.update(project, (f) => dismissContradiction(f, key));
  }

  async undismiss(project: ProjectSpec, key: string): Promise<void> {
    await this.storyRepo.update(project, (f) => undismissContradiction(f, key));
  }
}
