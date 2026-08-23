import { MythReport, validateMythReport } from "../../domain/myth/MythReport";
import type { MythAnalyser } from "../ports/MythAnalyser";
import { ScheduleAnalysis } from "./ScheduleAnalysis";

const MIN_WORDS = 40;

/**
 * On-demand, selection-scoped. Reports are cached by content hash for the
 * session so re-running on an unchanged scene is free.
 */
export class AnalyzeMyth {
  private readonly cache = new Map<string, MythReport>();

  constructor(private readonly analyser: MythAnalyser) {}

  async execute(text: string, signal: AbortSignal): Promise<MythReport> {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS) throw new Error(`Select at least ${MIN_WORDS} words — a scene, not a sentence.`);
    const key = `${this.analyser.name}|${ScheduleAnalysis.keyFor(text)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const report = validateMythReport(await this.analyser.analyse(text, signal), text);
    this.cache.set(key, report);
    return report;
  }
}
