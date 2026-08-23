import { describe, it, expect } from "vitest";
import { ConfiguredLlmAnalyser } from "../../../src/infrastructure/llm/ConfiguredLlmAnalyser";
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from "../../../src/domain/settings/Settings";
import { FakeHttp, OLLAMA_OK } from "./fixtures";

describe("ConfiguredLlmAnalyser", () => {
  const req = { text: "Some paragraph of prose here.", checks: ["cliche"] as const };

  it("returns nothing and makes no call when the provider is off", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: OLLAMA_OK }));
    const a = new ConfiguredLlmAnalyser(http, () => DEFAULT_LLM_SETTINGS);
    expect(await a.analyse(req, new AbortController().signal)).toEqual([]);
    expect(http.calls).toHaveLength(0);
    expect(a.name).toBe("off");
  });

  it("builds an Ollama adapter from settings and re-uses it until the config changes", async () => {
    let s: LlmSettings = { ...DEFAULT_LLM_SETTINGS, provider: "ollama", ollamaModel: "a" };
    const http = new FakeHttp(() => ({ status: 200, json: OLLAMA_OK }));
    const a = new ConfiguredLlmAnalyser(http, () => s);
    await a.analyse(req, new AbortController().signal);
    expect((http.calls[0]!.body as { model: string }).model).toBe("a");
    expect(a.name).toBe("ollama:a");
    s = { ...s, ollamaModel: "b" };
    await a.analyse(req, new AbortController().signal);
    expect((http.calls[1]!.body as { model: string }).model).toBe("b");
  });
});

describe("ConfiguredLlmAnalyser with Claude", () => {
  const CLAUDE_OK = {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ findings: [] }) }],
    usage: { input_tokens: 300, output_tokens: 250, cache_read_input_tokens: 1200, cache_creation_input_tokens: 0 },
  };
  const base: LlmSettings = { ...DEFAULT_LLM_SETTINGS, provider: "claude", claudeApiKey: "sk", dailyCapUsd: 0.02 };
  const req = { text: "Some paragraph of prose here.", checks: ["cliche"] as const };

  it("prices each call, persists the daily spend, and stops at the cap", async () => {
    const spends: number[] = [];
    const http = new FakeHttp(() => ({ status: 200, json: CLAUDE_OK }));
    const a = new ConfiguredLlmAnalyser(http, () => base, (s) => spends.push(s.usd));
    await a.analyse(req, new AbortController().signal);
    expect(a.ledger.sessionUsd).toBeGreaterThan(0.005);
    expect(spends).toHaveLength(1);
    await a.analyse(req, new AbortController().signal); // ~0.016 total
    await a.analyse(req, new AbortController().signal); // crosses 0.02
    await expect(a.analyse(req, new AbortController().signal)).rejects.toThrow(/daily cap/);
    expect(http.calls).toHaveLength(3);
  });

  it("switches adapter when the provider changes", async () => {
    let s: LlmSettings = { ...base };
    const http = new FakeHttp((c) => ({ status: 200, json: c.url.includes("anthropic") ? CLAUDE_OK : OLLAMA_OK }));
    const a = new ConfiguredLlmAnalyser(http, () => s);
    await a.analyse(req, new AbortController().signal);
    expect(a.name).toBe("claude-opus-5");
    s = { ...s, provider: "ollama" };
    await a.analyse(req, new AbortController().signal);
    expect(a.name).toBe("ollama:qwen2.5:7b");
  });
});
