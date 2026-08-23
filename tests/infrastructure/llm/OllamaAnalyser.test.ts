import { describe, it, expect } from "vitest";
import { OllamaAnalyser } from "../../../src/infrastructure/llm/OllamaAnalyser";
import { STYLE_RULEBOOK } from "../../../src/infrastructure/llm/prompts/styleRulebook";
import { FakeHttp, OLLAMA_OK } from "./fixtures";

const req = { text: "The silence bruised him.", checks: ["metaphor", "cliche"] as const };

describe("OllamaAnalyser", () => {
  it("posts a chat request with the rulebook, the paragraph, a JSON schema, and no streaming", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: OLLAMA_OK }));
    const a = new OllamaAnalyser(http, { baseUrl: "http://localhost:11434", model: "qwen2.5:7b" });
    await a.analyse(req, new AbortController().signal);
    const [call] = http.calls;
    expect(call!.url).toBe("http://localhost:11434/api/chat");
    const body = call!.body as Record<string, unknown>;
    expect(body.model).toBe("qwen2.5:7b");
    expect(body.stream).toBe(false);
    expect((body.messages as Array<{ role: string; content: string }>)[0]).toEqual({ role: "system", content: STYLE_RULEBOOK });
    expect((body.messages as Array<{ role: string; content: string }>)[1]!.content).toContain("The silence bruised him.");
    expect((body.messages as Array<{ role: string; content: string }>)[1]!.content).toContain("metaphor, cliche");
    expect((body.format as { properties: { findings: unknown } }).properties.findings).toBeDefined();
    expect((body.options as { temperature: number }).temperature).toBe(0);
  });

  it("returns the parsed findings array", async () => {
    const a = new OllamaAnalyser(new FakeHttp(() => ({ status: 200, json: OLLAMA_OK })), { baseUrl: "http://localhost:11434", model: "m" });
    const out = await a.analyse(req, new AbortController().signal);
    expect(out).toEqual([{ kind: "metaphor", quote: "silence bruised him", note: "Strained." }]);
  });

  it("strips <think> blocks and code fences that reasoning models emit", async () => {
    const content = "<think>hmm</think>\n```json\n" + JSON.stringify({ findings: [] }) + "\n```";
    const a = new OllamaAnalyser(new FakeHttp(() => ({ status: 200, json: { ...OLLAMA_OK, message: { role: "assistant", content } } })), { baseUrl: "x", model: "m" });
    expect(await a.analyse(req, new AbortController().signal)).toEqual([]);
  });

  it("throws a descriptive error on non-200", async () => {
    const a = new OllamaAnalyser(new FakeHttp(() => ({ status: 404, json: { error: "model 'nope' not found" } })), { baseUrl: "x", model: "nope" });
    await expect(a.analyse(req, new AbortController().signal)).rejects.toThrow(/nope/);
  });

  it("throws when the content is not the expected JSON shape", async () => {
    const a = new OllamaAnalyser(new FakeHttp(() => ({ status: 200, json: { message: { content: "not json" } } })), { baseUrl: "x", model: "m" });
    await expect(a.analyse(req, new AbortController().signal)).rejects.toThrow(/JSON/);
  });

  it("records token usage from the response", async () => {
    const a = new OllamaAnalyser(new FakeHttp(() => ({ status: 200, json: OLLAMA_OK })), { baseUrl: "x", model: "m" });
    await a.analyse(req, new AbortController().signal);
    expect(a.lastUsage).toEqual({ input: 812, output: 44 });
  });

  it("trims a trailing slash on the base url", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: OLLAMA_OK }));
    await new OllamaAnalyser(http, { baseUrl: "http://h:1/", model: "m" }).analyse(req, new AbortController().signal);
    expect(http.calls[0]!.url).toBe("http://h:1/api/chat");
  });
});
