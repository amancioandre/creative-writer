import type { HttpClient } from "../../application/ports/HttpClient";
import type { LlmAnalyser, LlmRequest } from "../../application/ports/LlmAnalyser";
import type { LlmSettings } from "../../domain/settings/Settings";
import { llmConfigEquals } from "../../domain/settings/Settings";
import { OllamaAnalyser, type TokenUsage } from "./OllamaAnalyser";

/**
 * Resolves the active adapter from settings at call time, so changing the
 * provider or model in the settings tab takes effect on the next analysis
 * without rebuilding editor extensions.
 */
export class ConfiguredLlmAnalyser implements LlmAnalyser {
  private current: { config: LlmSettings; adapter: OllamaAnalyser } | null = null;

  constructor(private readonly http: HttpClient, private readonly settings: () => LlmSettings) {}

  get name(): string {
    return this.resolve()?.name ?? "off";
  }

  get lastUsage(): TokenUsage | null {
    return this.current?.adapter.lastUsage ?? null;
  }

  async analyse(request: LlmRequest, signal: AbortSignal): Promise<unknown[]> {
    const adapter = this.resolve();
    if (!adapter) return [];
    return adapter.analyse(request, signal);
  }

  private resolve(): OllamaAnalyser | null {
    const config = this.settings();
    if (config.provider === "off") return null;
    if (this.current && llmConfigEquals(this.current.config, config)) return this.current.adapter;
    const adapter = new OllamaAnalyser(this.http, { baseUrl: config.ollamaUrl, model: config.ollamaModel });
    this.current = { config, adapter };
    return adapter;
  }
}
