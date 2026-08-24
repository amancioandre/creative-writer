import { describe, it, expect } from "vitest";
import { OllamaRelationAnalyser } from "../../../src/infrastructure/llm/OllamaRelationAnalyser";
import { RELATION_RULEBOOK } from "../../../src/infrastructure/llm/prompts/relationRulebook";
import { FakeHttp } from "./fixtures";

describe("OllamaRelationAnalyser", () => {
  it("sends the rulebook, the known names, the scene and the schema; returns the parsed object", async () => {
    const report = { relations: [], references: [], events: [] };
    const http = new FakeHttp(() => ({ status: 200, json: { message: { content: JSON.stringify(report) } } }));
    const a = new OllamaRelationAnalyser(http, { baseUrl: "http://localhost:11434/", model: "qwen2.5:14b" });
    const out = await a.analyse("Marta sat with Ilse.", ["Ilse", "Marta Kovács"], new AbortController().signal);
    const call = http.calls[0]!;
    const body = call.body as { messages: Array<{ role: string; content: string }>; format: { properties: Record<string, unknown> }; model: string };
    expect(call.url).toBe("http://localhost:11434/api/chat");
    expect(body.model).toBe("qwen2.5:14b");
    expect(body.messages[0]!.content).toBe(RELATION_RULEBOOK);
    expect(body.messages[1]!.content).toContain("Ilse; Marta Kovács");
    expect(body.messages[1]!.content).toContain("Marta sat with Ilse.");
    expect(Object.keys(body.format.properties)).toEqual(["relations", "references", "events"]);
    expect(out).toEqual(report);
    expect(a.name).toBe("ollama:qwen2.5:14b");
  });
  it("reports HTTP and non-JSON failures", async () => {
    const bad = new OllamaRelationAnalyser(new FakeHttp(() => ({ status: 500, json: { error: "boom" } })), { baseUrl: "x", model: "m" });
    await expect(bad.analyse("p", [], new AbortController().signal)).rejects.toThrow("boom");
    const junk = new OllamaRelationAnalyser(new FakeHttp(() => ({ status: 200, json: { message: { content: "nothing" } } })), { baseUrl: "x", model: "m" });
    await expect(junk.analyse("p", [], new AbortController().signal)).rejects.toThrow("not a JSON");
  });
});
