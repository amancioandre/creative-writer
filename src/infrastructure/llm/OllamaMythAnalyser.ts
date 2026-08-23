import type { HttpClient } from "../../application/ports/HttpClient";
import type { MythAnalyser } from "../../application/ports/MythAnalyser";
import { MYTH_RULEBOOK, MYTH_SCHEMA, mythUserMessage } from "./prompts/mythRulebook";
import { extractJson } from "./extractJson";
import type { OllamaConfig } from "./OllamaAnalyser";

/** Myth/archetype report via a local Ollama model. A larger (14B) model does noticeably better here than 7B. */
export class OllamaMythAnalyser implements MythAnalyser {
  readonly name: string;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  async analyse(text: string, signal: AbortSignal): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = {
      model: this.config.model,
      stream: false,
      format: MYTH_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: MYTH_RULEBOOK },
        { role: "user", content: mythUserMessage(text) },
      ],
    };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const parsed = extractJson((res.json as { message?: { content?: string } }).message?.content ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Ollama: response was not a JSON report");
    return parsed;
  }
}
