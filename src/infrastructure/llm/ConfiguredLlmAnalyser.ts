import type { HttpClient } from "../../application/ports/HttpClient";
import type { LlmAnalyser, LlmRequest } from "../../application/ports/LlmAnalyser";
import type { LlmSettings } from "../../domain/settings/Settings";
import { llmConfigEquals } from "../../domain/settings/Settings";
import { CostLedger, costOf, PRICES, type PersistedSpend } from "../../domain/style/llm/CostLedger";
import { OllamaAnalyser } from "./OllamaAnalyser";
import { ClaudeAnalyser } from "./ClaudeAnalyser";

type Adapter = OllamaAnalyser | ClaudeAnalyser;

export class DailyCapReached extends Error {
  constructor(cap: number) {
    super(`Claude: daily cap of $${cap.toFixed(2)} reached. Raise it in settings or wait until tomorrow.`);
    this.name = "DailyCapReached";
  }
}

/**
 * Resolves the active adapter from settings at call time, so changing the
 * provider or model in the settings tab takes effect on the next analysis.
 * Also the one place money is counted: every Claude call is priced and
 * added to the ledger, and the daily cap is enforced before the request.
 */
export class ConfiguredLlmAnalyser implements LlmAnalyser {
  private current: { config: LlmSettings; adapter: Adapter } | null = null;
  readonly ledger: CostLedger;

  constructor(
    private readonly http: HttpClient,
    private readonly settings: () => LlmSettings,
    private readonly persistSpend: (spend: PersistedSpend) => void = () => undefined,
  ) {
    this.ledger = CostLedger.fromPersisted(settings().spend);
  }

  get name(): string {
    return this.resolve()?.name ?? "off";
  }

  async analyse(request: LlmRequest, signal: AbortSignal): Promise<unknown[]> {
    const adapter = this.resolve();
    if (!adapter) return [];
    const config = this.settings();
    if (adapter instanceof ClaudeAnalyser && this.ledger.capReached(config.dailyCapUsd)) throw new DailyCapReached(config.dailyCapUsd);
    const out = await adapter.analyse(request, signal);
    if (adapter instanceof ClaudeAnalyser && adapter.lastUsage) {
      const price = PRICES[config.claudeModel];
      if (price) {
        this.ledger.add(costOf(adapter.lastUsage, price));
        this.persistSpend(this.ledger.persisted());
      }
    }
    return out;
  }

  private resolve(): Adapter | null {
    const config = this.settings();
    if (config.provider === "off") return null;
    if (this.current && llmConfigEquals(this.current.config, config)) return this.current.adapter;
    const adapter: Adapter =
      config.provider === "claude"
        ? new ClaudeAnalyser(this.http, { apiKey: config.claudeApiKey, model: config.claudeModel })
        : new OllamaAnalyser(this.http, { baseUrl: config.ollamaUrl, model: config.ollamaModel });
    this.current = { config, adapter };
    return adapter;
  }
}
