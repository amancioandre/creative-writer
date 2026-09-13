import type { HttpClient } from "../../application/ports/HttpClient";
import type { SentenceEmbedder } from "../../application/ports/SentenceEmbedder";
import type { OllamaConfig } from "./OllamaAnalyser";

/** Sentences → vectors through Ollama's embedding endpoint. `nomic-embed-text` is the suggested model. */
export class OllamaEmbedder implements SentenceEmbedder {
  readonly name: string;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  async embed(texts: readonly string[], signal: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/embed`;
    const res = await this.http.postJson(url, { model: this.config.model, input: texts }, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const out = (res.json as { embeddings?: unknown } | undefined)?.embeddings;
    if (!Array.isArray(out) || out.length !== texts.length || !out.every((v): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number"))) throw new Error("Ollama: response carried no embeddings");
    return out;
  }
}
