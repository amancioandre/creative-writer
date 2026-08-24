import type { HttpClient } from "../../application/ports/HttpClient";
import type { RelationAnalyser } from "../../application/ports/RelationAnalyser";
import { RELATION_RULEBOOK, RELATION_SCHEMA, relationUserMessage } from "./prompts/relationRulebook";
import { extractJson } from "./extractJson";
import type { OllamaConfig } from "./OllamaAnalyser";

/** Scene → relations/references/events via a local Ollama model. Same shape as the myth analyser. */
export class OllamaRelationAnalyser implements RelationAnalyser {
  readonly name: string;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  async analyse(text: string, present: readonly string[], signal: AbortSignal): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = {
      model: this.config.model,
      stream: false,
      format: RELATION_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: RELATION_RULEBOOK },
        { role: "user", content: relationUserMessage(text, present) },
      ],
    };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const parsed = extractJson((res.json as { message?: { content?: string } }).message?.content ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Ollama: response was not a JSON report");
    return parsed;
  }
}
