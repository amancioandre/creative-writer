import { pairEmbeddings, SEMANTIC_MIN_WORDS, type EmbeddingCandidate } from "../../domain/echoes/Semantic";
import type { ProjectSpec } from "../../domain/progress/Project";
import { putSemanticEchoes } from "../../domain/story/StoryMapFile";
import { sceneKey, textHash, type SceneRef, type StoryGraph } from "../../domain/story/StoryGraph";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { SentenceEmbedder } from "../ports/SentenceEmbedder";
import type { SentenceSegmenter } from "../ports/SentenceSegmenter";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import type { AnalyzeProgress } from "./AnalyzeSceneRelations";

/** Sentences per embedding call. */
const BATCH = 32;

/**
 * The echo finder's semantic tier, on command: every sentence of every
 * scene long enough to mean something is embedded by a local model, the
 * pairs that say the same thing are found, and only the pairs are kept
 * in `Story map.md` — never the vectors — with each scene's hash, so a
 * pair goes stale with its scene. One run replaces the last.
 */
export class AnalyzeProjectEchoes {
  constructor(private readonly notes: ProjectNotes, private readonly repo: StoryMapRepository, private readonly embedder: SentenceEmbedder, private readonly segmenter: SentenceSegmenter) {}

  async execute(project: ProjectSpec, graph: StoryGraph, signal: AbortSignal, onProgress?: (p: AnalyzeProgress) => void): Promise<number> {
    const notes = await this.notes.notes(project);
    const byNote = new Map(notes.map((n) => [n.path, n]));
    const candidates: EmbeddingCandidate[] = [];
    const hashes = new Map<string, string>();
    graph.timeline.forEach((row, index) => {
      const scene = byNote.get(row.scene.path)?.scenes.find((s) => s.line === row.scene.line && s.title === row.scene.title);
      if (!scene) return;
      hashes.set(sceneKey(row.scene), textHash(scene.prose));
      const breaks = [...scene.prose.matchAll(/\n\s*\n/g)].map((m) => m.index + m[0].length);
      for (const s of this.segmenter.segment(scene.prose)) {
        const text = s.text.trim();
        if (text.split(/\s+/).filter(Boolean).length < SEMANTIC_MIN_WORDS) continue;
        const paragraph = breaks.filter((b) => b <= s.from).length;
        candidates.push({ scene: row.scene, index, paragraph, text });
      }
    });
    const vectors: number[][] = [];
    for (let i = 0; i < candidates.length; i += BATCH) {
      if (signal.aborted) return 0;
      const batch = candidates.slice(i, i + BATCH);
      vectors.push(...(await this.embedder.embed(batch.map((c) => c.text), signal)));
      onProgress?.({ done: Math.min(candidates.length, i + BATCH), total: candidates.length, scene: batch[batch.length - 1]!.scene, skipped: false });
    }
    if (signal.aborted) return 0;
    const hashOf = (scene: SceneRef) => hashes.get(sceneKey(scene)) ?? "";
    const pairs = pairEmbeddings(candidates, vectors, hashOf, this.embedder.name);
    await this.repo.update(project, (latest) => putSemanticEchoes(latest, pairs));
    return pairs.length;
  }
}
