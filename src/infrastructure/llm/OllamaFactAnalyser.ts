import type { HttpClient } from "../../application/ports/HttpClient";
import type { FactAnalyser } from "../../application/ports/FactAnalyser";
import { FACT_RULEBOOK, FACT_RULEBOOK_VERSION, FACT_SCHEMA, factUserMessage } from "./prompts/factRulebook";
import { extractJson } from "./extractJson";
import type { OllamaConfig } from "./OllamaAnalyser";

/** Scene → facts via a local Ollama model. Same shape as the relation analyser. */
export class OllamaFactAnalyser implements FactAnalyser {
  readonly name: string;
  readonly rulebook = FACT_RULEBOOK_VERSION;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  async analyse(text: string, present: readonly string[], signal: AbortSignal): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = {
      model: this.config.model,
      stream: false,
      format: FACT_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: FACT_RULEBOOK },
        { role: "user", content: factUserMessage(text, present) },
      ],
    };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const parsed = extractJson((res.json as { message?: { content?: string } }).message?.content ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Ollama: response was not a JSON report");
    return parsed;
  }
}
