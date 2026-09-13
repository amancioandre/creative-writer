import { describe, it, expect } from "vitest";
import { OllamaIntentAnalyser } from "../../../src/infrastructure/llm/OllamaIntentAnalyser";
import { OllamaEmbedder } from "../../../src/infrastructure/llm/OllamaEmbedder";
import { INTENT_RULEBOOK, INTENT_RULEBOOK_VERSION } from "../../../src/infrastructure/llm/prompts/intentRulebook";
import { FakeHttp } from "./fixtures";

const request = { subject: "Ilse", attribute: "eye colour", first: { scene: "Creek", value: "green", evidence: "her green eyes", context: "She washed her green eyes in it." }, second: { scene: "Return", value: "grey", evidence: "grey eyes", context: "Her grey eyes had not changed." } };

describe("OllamaIntentAnalyser", () => {
  it("sends the rulebook, both passages in order and the schema; returns the parsed object", async () => {
    const report = { verdict: "reversal", reason: "the later scene notes the change", confidence: 0.8 };
    const http = new FakeHttp(() => ({ status: 200, json: { message: { content: JSON.stringify(report) } } }));
    const a = new OllamaIntentAnalyser(http, { baseUrl: "http://localhost:11434/", model: "qwen2.5:7b" });
    const out = await a.analyse(request, new AbortController().signal);
    const body = http.calls[0]!.body as { messages: Array<{ content: string }>; format: { properties: Record<string, unknown> }; model: string; options: { temperature: number } };
    expect(http.calls[0]!.url).toBe("http://localhost:11434/api/chat");
    expect(body.model).toBe("qwen2.5:7b");
    expect(body.options.temperature).toBe(0);
    expect(body.messages[0]!.content).toBe(INTENT_RULEBOOK);
    const user = body.messages[1]!.content;
    expect(user.indexOf("Earlier passage (Creek)")).toBeLessThan(user.indexOf("Later passage (Return)"));
    expect(user).toContain("She washed her green eyes in it.");
    expect(user).toContain('Stated in: "grey eyes"');
    expect(Object.keys(body.format.properties)).toEqual(["verdict", "reason", "confidence"]);
    expect(out).toEqual(report);
    expect(a.rulebook).toBe(INTENT_RULEBOOK_VERSION);
  });

  it("reports HTTP and non-JSON failures", async () => {
    const bad = new OllamaIntentAnalyser(new FakeHttp(() => ({ status: 500, json: { error: "boom" } })), { baseUrl: "x", model: "m" });
    await expect(bad.analyse(request, new AbortController().signal)).rejects.toThrow("boom");
    const junk = new OllamaIntentAnalyser(new FakeHttp(() => ({ status: 200, json: { message: { content: "nothing" } } })), { baseUrl: "x", model: "m" });
    await expect(junk.analyse(request, new AbortController().signal)).rejects.toThrow("not a JSON");
  });
});

describe("OllamaEmbedder", () => {
  it("posts the texts to the embedding endpoint and returns one vector each", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: { embeddings: [[0.1, 0.2], [0.3, 0.4]] } }));
    const e = new OllamaEmbedder(http, { baseUrl: "http://localhost:11434", model: "nomic-embed-text" });
    expect(await e.embed(["a", "b"], new AbortController().signal)).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    expect(http.calls[0]!.url).toBe("http://localhost:11434/api/embed");
    expect(http.calls[0]!.body).toEqual({ model: "nomic-embed-text", input: ["a", "b"] });
    expect(e.name).toBe("ollama:nomic-embed-text");
    expect(await e.embed([], new AbortController().signal)).toEqual([]);
    expect(http.calls).toHaveLength(1);
  });

  it("rejects a wrong count, non-numbers and errors", async () => {
    const short = new OllamaEmbedder(new FakeHttp(() => ({ status: 200, json: { embeddings: [[1]] } })), { baseUrl: "x", model: "m" });
    await expect(short.embed(["a", "b"], new AbortController().signal)).rejects.toThrow("no embeddings");
    const junk = new OllamaEmbedder(new FakeHttp(() => ({ status: 200, json: { embeddings: [["x"]] } })), { baseUrl: "x", model: "m" });
    await expect(junk.embed(["a"], new AbortController().signal)).rejects.toThrow("no embeddings");
    const bad = new OllamaEmbedder(new FakeHttp(() => ({ status: 404, json: { error: "model not found" } })), { baseUrl: "x", model: "m" });
    await expect(bad.embed(["a"], new AbortController().signal)).rejects.toThrow("model not found");
  });
});
