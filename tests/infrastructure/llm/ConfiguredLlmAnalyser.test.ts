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
    expect(a.lastUsage).toEqual({ input: 812, output: 44 });
  });
});
