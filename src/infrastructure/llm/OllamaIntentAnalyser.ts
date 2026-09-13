import type { HttpClient } from "../../application/ports/HttpClient";
import type { IntentAnalyser, IntentRequest } from "../../application/ports/IntentAnalyser";
import { INTENT_RULEBOOK, INTENT_RULEBOOK_VERSION, INTENT_SCHEMA, intentUserMessage } from "./prompts/intentRulebook";
import { extractJson } from "./extractJson";
import type { OllamaConfig } from "./OllamaAnalyser";

/** Contradiction → verdict via a local Ollama model. Same shape as the fact analyser. */
export class OllamaIntentAnalyser implements IntentAnalyser {
  readonly name: string;
  readonly rulebook = INTENT_RULEBOOK_VERSION;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  async analyse(request: IntentRequest, signal: AbortSignal): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = {
      model: this.config.model,
      stream: false,
      format: INTENT_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: INTENT_RULEBOOK },
        { role: "user", content: intentUserMessage(request) },
      ],
    };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const parsed = extractJson((res.json as { message?: { content?: string } }).message?.content ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Ollama: response was not a JSON report");
    return parsed;
  }
}
