import { describe, it, expect } from "vitest";
import { OllamaMythAnalyser } from "../../../src/infrastructure/llm/OllamaMythAnalyser";
import { MYTH_RULEBOOK } from "../../../src/infrastructure/llm/prompts/mythRulebook";
import { FakeHttp } from "./fixtures";

describe("OllamaMythAnalyser", () => {
  it("sends the myth rulebook, the passage, and a report schema; returns the parsed object", async () => {
    const report = { patterns: [], archetypes: [], summary: "s", next: "n" };
    const http = new FakeHttp(() => ({ status: 200, json: { message: { content: JSON.stringify(report) } } }));
    const a = new OllamaMythAnalyser(http, { baseUrl: "http://localhost:11434", model: "deepseek-r1:14b" });
    const out = await a.analyse("A passage.", new AbortController().signal);
    const body = http.calls[0]!.body as { messages: Array<{ role: string; content: string }>; format: { properties: Record<string, unknown> }; model: string };
    expect(body.model).toBe("deepseek-r1:14b");
    expect(body.messages[0]!.content).toBe(MYTH_RULEBOOK);
    expect(body.messages[1]!.content).toContain("A passage.");
    expect(Object.keys(body.format.properties)).toEqual(["patterns", "archetypes", "summary", "next"]);
    expect(out).toEqual(report);
  });
  it("strips <think> blocks (reasoning models)", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: { message: { content: "<think>…</think>{\"patterns\":[],\"archetypes\":[],\"summary\":\"\",\"next\":\"\"}" } } }));
    const out = await new OllamaMythAnalyser(http, { baseUrl: "x", model: "m" }).analyse("p", new AbortController().signal);
    expect(out).toMatchObject({ patterns: [] });
  });
});
