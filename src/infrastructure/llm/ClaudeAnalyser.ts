import type { HttpClient } from "../../application/ports/HttpClient";
import type { LlmAnalyser, LlmRequest } from "../../application/ports/LlmAnalyser";
import type { Usage } from "../../domain/style/llm/CostLedger";
import { STYLE_RULEBOOK, findingsSchema, userMessage } from "./prompts/styleRulebook";
import { extractJson } from "./extractJson";

export type ClaudeModel = "claude-opus-5" | "claude-haiku-4-5";

export interface ClaudeConfig {
  readonly apiKey: string;
  readonly model: ClaudeModel;
  readonly baseUrl?: string;
}

interface MessagesResponse {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  error?: { type?: string; message?: string };
}

/**
 * Claude via the Messages API over `requestUrl`. No streaming: one small
 * structured response per paragraph is the right shape. The rulebook is
 * the cached prefix (Opus 5's minimum cacheable prefix is 512 tokens; the
 * rulebook is well past that), so repeat calls pay ~10% for it.
 *
 * Opus 5: thinking is adaptive by default and kept on; `effort: "low"`
 * bounds it. `fallbacks: "default"` reroutes a safety refusal server-side.
 * Haiku 4.5 supports neither effort nor fallbacks, so both are omitted.
 */
export class ClaudeAnalyser implements LlmAnalyser {
  readonly name: string;
  lastUsage: Usage | null = null;

  constructor(private readonly http: HttpClient, private readonly config: ClaudeConfig) {
    this.name = config.model;
  }

  async analyse(request: LlmRequest, signal: AbortSignal): Promise<unknown[]> {
    if (!this.config.apiKey.trim()) throw new Error("Claude: no API key configured (Settings → Creative Zen Mode → Model assistant).");
    const opus = this.config.model === "claude-opus-5";
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: 2048,
      system: [{ type: "text", text: STYLE_RULEBOOK, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage(request.text, request.checks) }],
      output_config: opus
        ? { format: { type: "json_schema", schema: findingsSchema(request.checks) }, effort: "low" }
        : { format: { type: "json_schema", schema: findingsSchema(request.checks) } },
    };
    const headers: Record<string, string> = { "x-api-key": this.config.apiKey, "anthropic-version": "2023-06-01" };
    if (opus) {
      body.fallbacks = "default";
      headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    }

    const url = `${(this.config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "")}/v1/messages`;
    const res = await this.http.postJson(url, body, headers, signal);
    const r = res.json as MessagesResponse | undefined;
    if (res.status !== 200) throw new Error(`Claude: ${r?.error?.message ?? `HTTP ${res.status}`}`);

    if (r?.usage) {
      this.lastUsage = {
        input: r.usage.input_tokens ?? 0,
        output: r.usage.output_tokens ?? 0,
        cacheRead: r.usage.cache_read_input_tokens ?? 0,
        cacheWrite: r.usage.cache_creation_input_tokens ?? 0,
      };
    }
    if (r?.stop_reason === "refusal") return [];

    const text = r?.content?.find((c) => c.type === "text")?.text ?? "";
    const findings = (extractJson(text) as { findings?: unknown } | null)?.findings;
    if (!Array.isArray(findings)) throw new Error("Claude: response was not the expected JSON ({findings: [...]})");
    return findings;
  }
}
