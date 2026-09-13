import type { ProjectSpec } from "../../domain/progress/Project";
import { putIntent } from "../../domain/story/StoryMapFile";
import { validateIntent } from "../../domain/threads/Intent";
import { isLiveContradiction, type Contradiction } from "../../domain/threads/Thread";
import { locateQuote } from "../../domain/text/LocateQuote";
import type { IntentAnalyser, IntentSide } from "../ports/IntentAnalyser";
import type { ProjectNotes } from "../ports/ProjectNotes";
import type { StoryMapRepository } from "../ports/StoryMapRepository";
import type { AnalyzeProgress } from "./AnalyzeSceneRelations";

/** Most characters of the paragraph around a quote that the model is shown. */
const CONTEXT_CHARS = 700;

/**
 * Asks the local model what each open contradiction means — a reversal
 * the story intends, an error, or the same thing said twice — and keeps
 * the verdict in `Story map.md` by the contradiction's key. A verdict is
 * a proposal for the card; accepting it is the writer's click. Pairs
 * already read under this rulebook are skipped unless forced, and the
 * file is saved after every pair so an abort loses nothing.
 */
export class AnalyzeContradictionIntent {
  constructor(private readonly notes: ProjectNotes, private readonly repo: StoryMapRepository, private readonly analyser: IntentAnalyser) {}

  async execute(project: ProjectSpec, contradictions: readonly Contradiction[], signal: AbortSignal, onProgress?: (p: AnalyzeProgress) => void, force = false): Promise<number> {
    const open = contradictions.filter(isLiveContradiction);
    if (open.length === 0) return 0;
    const notes = await this.notes.notes(project);
    const prose = (path: string, line: number): string => notes.find((n) => n.path === path)?.scenes.find((s) => s.line === line)?.prose ?? "";
    let file = await this.repo.load(project);
    let analysed = 0;
    for (let i = 0; i < open.length; i++) {
      const c = open[i]!;
      const existing = file.intents.find((r) => r.key === c.key);
      if (!force && existing && existing.rulebook === this.analyser.rulebook) {
        onProgress?.({ done: i + 1, total: open.length, scene: c.a.scene, skipped: true });
        continue;
      }
      if (signal.aborted) break;
      const [first, second] = c.a.index <= c.b.index ? [c.a, c.b] : [c.b, c.a];
      const side = (r: typeof first): IntentSide => ({ scene: r.scene.title || r.scene.path, value: r.value ?? r.note, evidence: r.evidence ?? "", context: contextOf(prose(r.scene.path, r.scene.line), r.evidence ?? "") });
      const raw = await this.analyser.analyse({ subject: c.subject, attribute: c.attribute, first: side(first), second: side(second) }, signal);
      const verdict = validateIntent(raw);
      if (!verdict) { onProgress?.({ done: i + 1, total: open.length, scene: c.a.scene, skipped: true }); continue; }
      file = await this.repo.update(project, (latest) => putIntent(latest, { key: c.key, ...verdict, model: this.analyser.name, rulebook: this.analyser.rulebook }));
      analysed++;
      onProgress?.({ done: i + 1, total: open.length, scene: c.a.scene, skipped: false });
    }
    return analysed;
  }
}

/** The paragraph holding the quote, capped; the quote alone when it cannot be found. */
export function contextOf(prose: string, evidence: string): string {
  if (!prose || !evidence) return evidence;
  const hit = locateQuote(prose, evidence);
  if (!hit) return evidence;
  const start = prose.lastIndexOf("\n\n", hit[0]);
  const endAt = prose.indexOf("\n\n", hit[1]);
  const from = start < 0 ? 0 : start + 2, to = endAt < 0 ? prose.length : endAt;
  const paragraph = prose.slice(from, to).trim();
  if (paragraph.length <= CONTEXT_CHARS) return paragraph;
  const mid = hit[0] - from;
  const lo = Math.max(0, mid - CONTEXT_CHARS / 2);
  return `${lo > 0 ? "…" : ""}${paragraph.slice(lo, lo + CONTEXT_CHARS).trim()}${lo + CONTEXT_CHARS < paragraph.length ? "…" : ""}`;
}
