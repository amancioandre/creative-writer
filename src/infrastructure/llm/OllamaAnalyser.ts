import type { HttpClient } from "../../application/ports/HttpClient";
import type { LlmAnalyser, LlmRequest } from "../../application/ports/LlmAnalyser";
import { STYLE_RULEBOOK, findingsSchema, userMessage } from "./prompts/styleRulebook";
import { extractJson } from "./extractJson";

export interface OllamaConfig {
  readonly baseUrl: string;
  readonly model: string;
}

export interface TokenUsage {
  readonly input: number;
  readonly output: number;
}

/**
 * Local model via Ollama's /api/chat with schema-constrained output.
 * Temperature 0: we want the same findings for the same paragraph, which
 * also makes the scheduler's cache honest.
 */
export class OllamaAnalyser implements LlmAnalyser {
  readonly name: string;
  lastUsage: TokenUsage | null = null;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  async analyse(request: LlmRequest, signal: AbortSignal): Promise<unknown[]> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = {
      model: this.config.model,
      stream: false,
      format: findingsSchema(request.checks),
      options: { temperature: 0 },
      messages: [
        { role: "system", content: STYLE_RULEBOOK },
        { role: "user", content: userMessage(request.text, request.checks) },
      ],
    };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) {
      const err = (res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`;
      throw new Error(`Ollama: ${err}`);
    }
    const r = res.json as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    if (typeof r.prompt_eval_count === "number" && typeof r.eval_count === "number") {
      this.lastUsage = { input: r.prompt_eval_count, output: r.eval_count };
    }
    const parsed = extractJson(r.message?.content ?? "");
    const findings = (parsed as { findings?: unknown } | null)?.findings;
    if (!Array.isArray(findings)) throw new Error("Ollama: response was not the expected JSON ({findings: [...]})");
    return findings;
  }
}
