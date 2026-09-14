import type { HttpClient } from "../../application/ports/HttpClient";
import type { ColumnAnalyser, ColumnBrief } from "../../application/ports/ColumnAnalyser";
import { CHECK_RULEBOOK, CHECK_SCHEMA, GRID_RULEBOOK, GRID_RULEBOOK_VERSION, GRID_SCHEMA, PROPOSE_RULEBOOK, PROPOSE_SCHEMA, checkUserMessage, gridUserMessage, proposeUserMessage } from "./prompts/gridRulebook";
import type { ProposalBrief } from "../../domain/plot/Proposals";
import { extractJson } from "./extractJson";
import type { OllamaConfig } from "./OllamaAnalyser";

/** Scene → one column's reading, or a plan's check, via a local Ollama model. Same shape as the fact analyser. */
export class OllamaColumnAnalyser implements ColumnAnalyser {
  readonly name: string;
  readonly rulebook = GRID_RULEBOOK_VERSION;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
  }

  read(text: string, present: readonly string[], column: ColumnBrief, signal: AbortSignal): Promise<unknown> {
    return this.ask(GRID_RULEBOOK, gridUserMessage(text, present, column), GRID_SCHEMA, signal);
  }

  check(text: string, plan: { readonly note: string; readonly role: string | null }, column: ColumnBrief, signal: AbortSignal): Promise<unknown> {
    return this.ask(CHECK_RULEBOOK, checkUserMessage(text, plan, column), CHECK_SCHEMA, signal);
  }

  propose(brief: ProposalBrief, signal: AbortSignal): Promise<unknown> {
    return this.ask(PROPOSE_RULEBOOK, proposeUserMessage(brief), PROPOSE_SCHEMA, signal);
  }

  private async ask(system: string, user: string, schema: unknown, signal: AbortSignal): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = { model: this.config.model, stream: false, format: schema, options: { temperature: 0 }, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const parsed = extractJson((res.json as { message?: { content?: string } }).message?.content ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Ollama: response was not a JSON report");
    return parsed;
  }
}
