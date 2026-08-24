import { describe, it, expect } from "vitest";
import { OllamaFactAnalyser } from "../../../src/infrastructure/llm/OllamaFactAnalyser";
import { FACT_RULEBOOK, FACT_RULEBOOK_VERSION } from "../../../src/infrastructure/llm/prompts/factRulebook";
import { FakeHttp } from "./fixtures";

describe("OllamaFactAnalyser", () => {
  it("sends the rulebook, the known names, the scene and the schema; returns the parsed object", async () => {
    const report = { facts: [{ subject: "Ilse", attribute: "eye colour", value: "green", evidence: "green eyes" }] };
    const http = new FakeHttp(() => ({ status: 200, json: { message: { content: `Here you go:\n\`\`\`json\n${JSON.stringify(report)}\n\`\`\`` } } }));
    const a = new OllamaFactAnalyser(http, { baseUrl: "http://localhost:11434/", model: "qwen2.5:14b" });
    const out = await a.analyse("Ilse had green eyes.", ["Ilse", "Marta Kovács"], new AbortController().signal);
    const call = http.calls[0]!;
    const body = call.body as { messages: Array<{ role: string; content: string }>; format: { properties: Record<string, unknown> }; model: string; options: { temperature: number } };
    expect(call.url).toBe("http://localhost:11434/api/chat");
    expect(body.model).toBe("qwen2.5:14b");
    expect(body.options.temperature).toBe(0);
    expect(body.messages[0]!.content).toBe(FACT_RULEBOOK);
    expect(body.messages[1]!.content).toContain("Ilse; Marta Kovács");
    expect(body.messages[1]!.content).toContain("Ilse had green eyes.");
    expect(Object.keys(body.format.properties)).toEqual(["facts"]);
    expect(out).toEqual(report);
    expect(a.name).toBe("ollama:qwen2.5:14b");
    expect(a.rulebook).toBe(FACT_RULEBOOK_VERSION);
  });
  it("reports HTTP and non-JSON failures", async () => {
    const bad = new OllamaFactAnalyser(new FakeHttp(() => ({ status: 500, json: { error: "boom" } })), { baseUrl: "x", model: "m" });
    await expect(bad.analyse("p", [], new AbortController().signal)).rejects.toThrow("boom");
    const junk = new OllamaFactAnalyser(new FakeHttp(() => ({ status: 200, json: { message: { content: "nothing" } } })), { baseUrl: "x", model: "m" });
    await expect(junk.analyse("p", [], new AbortController().signal)).rejects.toThrow("not a JSON");
    const empty = new OllamaFactAnalyser(new FakeHttp(() => ({ status: 200, json: {} })), { baseUrl: "x", model: "m" });
    await expect(empty.analyse("p", [], new AbortController().signal)).rejects.toThrow("not a JSON");
  });
});
