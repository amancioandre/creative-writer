import { describe, it, expect } from "vitest";
import { ClaudeAnalyser } from "../../../src/infrastructure/llm/ClaudeAnalyser";
import { STYLE_RULEBOOK } from "../../../src/infrastructure/llm/prompts/styleRulebook";
import { FakeHttp } from "./fixtures";

const req = { text: "The silence bruised him.", checks: ["metaphor", "cliche"] as const };
const OK = {
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5", stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ findings: [{ kind: "metaphor", quote: "silence bruised", note: "Strained." }] }) }],
  usage: { input_tokens: 310, output_tokens: 42, cache_read_input_tokens: 1180, cache_creation_input_tokens: 0 },
};
const mk = (json: unknown, status = 200, model: "claude-opus-5" | "claude-haiku-4-5" = "claude-opus-5") => {
  const http = new FakeHttp(() => ({ status, json }));
  return { http, a: new ClaudeAnalyser(http, { apiKey: "sk-test", model }) };
};

describe("ClaudeAnalyser request", () => {
  it("posts to /v1/messages with key, version, structured output, low effort, cached system prompt, and default fallbacks on Opus 5", async () => {
    const { http, a } = mk(OK);
    await a.analyse(req, new AbortController().signal);
    const [call] = http.calls;
    expect(call!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call!.headers["x-api-key"]).toBe("sk-test");
    expect(call!.headers["anthropic-version"]).toBe("2023-06-01");
    expect(call!.headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    const body = call!.body as Record<string, unknown>;
    expect(body.model).toBe("claude-opus-5");
    expect(body.fallbacks).toBe("default");
    expect(body.stream).toBeUndefined();
    expect(body.system).toEqual([{ type: "text", text: STYLE_RULEBOOK, cache_control: { type: "ephemeral" } }]);
    expect((body.output_config as { effort: string }).effort).toBe("low");
    expect((body.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect((body.messages as Array<{ content: string }>)[0]!.content).toContain("The silence bruised him.");
    expect(body.thinking).toBeUndefined(); // Opus 5 runs adaptive by default
  });

  it("omits effort and fallbacks on Haiku 4.5 (unsupported there)", async () => {
    const { http, a } = mk(OK, 200, "claude-haiku-4-5");
    await a.analyse(req, new AbortController().signal);
    const body = http.calls[0]!.body as Record<string, unknown>;
    expect(body.fallbacks).toBeUndefined();
    expect(http.calls[0]!.headers["anthropic-beta"]).toBeUndefined();
    expect((body.output_config as Record<string, unknown>).effort).toBeUndefined();
  });
});

describe("ClaudeAnalyser response", () => {
  it("returns parsed findings and records usage with cache fields", async () => {
    const { a } = mk(OK);
    expect(await a.analyse(req, new AbortController().signal)).toEqual([{ kind: "metaphor", quote: "silence bruised", note: "Strained." }]);
    expect(a.lastUsage).toEqual({ input: 310, output: 42, cacheRead: 1180, cacheWrite: 0 });
  });

  it("treats a refusal as no findings, not an error", async () => {
    const { a } = mk({ ...OK, stop_reason: "refusal", content: [] });
    expect(await a.analyse(req, new AbortController().signal)).toEqual([]);
  });

  it("surfaces API errors with the server's message", async () => {
    const { a } = mk({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401);
    await expect(a.analyse(req, new AbortController().signal)).rejects.toThrow(/invalid x-api-key/);
  });

  it("rejects when no API key is configured, before any request", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: OK }));
    await expect(new ClaudeAnalyser(http, { apiKey: "", model: "claude-opus-5" }).analyse(req, new AbortController().signal)).rejects.toThrow(/API key/);
    expect(http.calls).toHaveLength(0);
  });
});
