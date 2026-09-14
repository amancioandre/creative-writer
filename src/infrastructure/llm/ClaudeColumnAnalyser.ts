import type { HttpClient } from "../../application/ports/HttpClient";
import type { ColumnAnalyser, ColumnBrief } from "../../application/ports/ColumnAnalyser";
import type { Usage } from "../../domain/style/llm/CostLedger";
import type { ClaudeConfig } from "./ClaudeAnalyser";
import { CHECK_RULEBOOK, CHECK_SCHEMA, GRID_RULEBOOK, GRID_RULEBOOK_VERSION, GRID_SCHEMA, checkUserMessage, gridUserMessage } from "./prompts/gridRulebook";
import { extractJson } from "./extractJson";

interface MessagesResponse {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  error?: { type?: string; message?: string };
}

/**
 * The column reader over Claude's Messages API, the same request shape as
 * the style analyser: the rulebook is the cached system prefix, the answer
 * is a JSON schema, effort is low on Opus. `lastUsage` is read by the
 * caller that counts money; the cap is enforced before the call is made.
 */
export class ClaudeColumnAnalyser implements ColumnAnalyser {
  readonly name: string;
  readonly rulebook = GRID_RULEBOOK_VERSION;
  lastUsage: Usage | null = null;

  constructor(private readonly http: HttpClient, private readonly config: ClaudeConfig) {
    this.name = config.model;
  }

  read(text: string, present: readonly string[], column: ColumnBrief, signal: AbortSignal): Promise<unknown> {
    return this.ask(GRID_RULEBOOK, gridUserMessage(text, present, column), GRID_SCHEMA, signal);
  }

  check(text: string, plan: { readonly note: string; readonly role: string | null }, column: ColumnBrief, signal: AbortSignal): Promise<unknown> {
    return this.ask(CHECK_RULEBOOK, checkUserMessage(text, plan, column), CHECK_SCHEMA, signal);
  }

  private async ask(system: string, user: string, schema: unknown, signal: AbortSignal): Promise<unknown> {
    if (!this.config.apiKey.trim()) throw new Error("Claude: no API key configured (Settings → creative-writer → Model assistant).");
    const opus = this.config.model === "claude-opus-5";
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: 512,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: opus ? { format: { type: "json_schema", schema }, effort: "low" } : { format: { type: "json_schema", schema } },
    };
    const headers: Record<string, string> = { "x-api-key": this.config.apiKey, "anthropic-version": "2023-06-01" };
    if (opus) { body.fallbacks = "default"; headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; }
    const url = `${(this.config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "")}/v1/messages`;
    const res = await this.http.postJson(url, body, headers, signal);
    const r = res.json as MessagesResponse | undefined;
    if (res.status !== 200) throw new Error(`Claude: ${r?.error?.message ?? `HTTP ${res.status}`}`);
    if (r?.usage) this.lastUsage = { input: r.usage.input_tokens ?? 0, output: r.usage.output_tokens ?? 0, cacheRead: r.usage.cache_read_input_tokens ?? 0, cacheWrite: r.usage.cache_creation_input_tokens ?? 0 };
    if (r?.stop_reason === "refusal") return { reading: null, found: false, evidence: "" };
    const parsed = extractJson(r?.content?.find((c) => c.type === "text")?.text ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Claude: response was not a JSON report");
    return parsed;
  }
}
