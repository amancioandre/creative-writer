import { describe, it, expect } from "vitest";
import { OllamaColumnAnalyser } from "../../../src/infrastructure/llm/OllamaColumnAnalyser";
import { ClaudeColumnAnalyser } from "../../../src/infrastructure/llm/ClaudeColumnAnalyser";
import { GRID_RULEBOOK, CHECK_RULEBOOK } from "../../../src/infrastructure/llm/prompts/gridRulebook";
import type { HttpClient } from "../../../src/application/ports/HttpClient";

function http(reply: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const client: HttpClient = { postJson: async (url, body, headers) => { calls.push({ url, body: body as Record<string, unknown>, headers: headers ?? {} }); return { status, json: reply }; } };
  return { client, calls };
}
const brief = { name: "The letter", kind: "subplot" as const, examples: ["pockets it"] };

describe("column analysers", () => {
  it("Ollama: the rulebook as system, the brief in the user turn, the schema as format, JSON back", async () => {
    const { client, calls } = http({ message: { content: '{"reading": {"text": "keeps it", "role": "plant", "evidence": "pocketed"}}' } });
    const a = new OllamaColumnAnalyser(client, { baseUrl: "http://localhost:11434/", model: "qwen2.5:7b" });
    expect(a.name).toBe("ollama:qwen2.5:7b");
    const out = await a.read("She pocketed it.", ["Anna"], brief, new AbortController().signal);
    expect(out).toEqual({ reading: { text: "keeps it", role: "plant", evidence: "pocketed" } });
    expect(calls[0]!.url).toBe("http://localhost:11434/api/chat");
    const msgs = calls[0]!.body.messages as { role: string; content: string }[];
    expect(msgs[0]!.content).toBe(GRID_RULEBOOK);
    expect(msgs[1]!.content).toContain("Column: The letter (subplot)");
    expect(msgs[1]!.content).toContain("“pockets it”");
    expect((calls[0]!.body.format as { required: string[] }).required).toEqual(["reading"]);
    await a.check("She pocketed it.", { note: "pockets it", role: "plant" }, brief, new AbortController().signal);
    expect((calls[1]!.body.messages as { content: string }[])[0]!.content).toBe(CHECK_RULEBOOK);
    expect((calls[1]!.body.messages as { content: string }[])[1]!.content).toContain("The outline says this scene: plant: pockets it");
  });

  it("Ollama: an error status or a non-JSON answer is an error", async () => {
    const bad = new OllamaColumnAnalyser(http({ error: "model not found" }, 404).client, { baseUrl: "http://x", model: "m" });
    await expect(bad.read("t", [], brief, new AbortController().signal)).rejects.toThrow("model not found");
    const junk = new OllamaColumnAnalyser(http({ message: { content: "nope" } }).client, { baseUrl: "http://x", model: "m" });
    await expect(junk.read("t", [], brief, new AbortController().signal)).rejects.toThrow("not a JSON report");
  });

  it("Claude: cached system prefix, a JSON schema, low effort on Opus, usage recorded, a refusal read as nothing", async () => {
    const { client, calls } = http({ content: [{ type: "text", text: '{"reading": null}' }], usage: { input_tokens: 900, output_tokens: 20, cache_read_input_tokens: 800 } });
    const a = new ClaudeColumnAnalyser(client, { apiKey: "k", model: "claude-opus-5" });
    expect(await a.read("t", [], brief, new AbortController().signal)).toEqual({ reading: null });
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect((calls[0]!.body.system as { cache_control: unknown }[])[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect((calls[0]!.body.output_config as { effort: string }).effort).toBe("low");
    expect(calls[0]!.headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    expect(a.lastUsage).toEqual({ input: 900, output: 20, cacheRead: 800, cacheWrite: 0 });
    const haiku = new ClaudeColumnAnalyser(http({ stop_reason: "refusal", content: [] }).client, { apiKey: "k", model: "claude-haiku-4-5" });
    expect(await haiku.check("t", { note: "x", role: null }, brief, new AbortController().signal)).toEqual({ reading: null, found: false, evidence: "" });
    const none = new ClaudeColumnAnalyser(client, { apiKey: " ", model: "claude-haiku-4-5" });
    await expect(none.read("t", [], brief, new AbortController().signal)).rejects.toThrow("no API key");
  });
});
