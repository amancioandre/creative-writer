import { describe, it, expect } from "vitest";
import { ClaudeAnalyser } from "../../src/infrastructure/llm/ClaudeAnalyser";
import { AnalyzeParagraphWithLlm } from "../../src/application/use-cases/AnalyzeParagraphWithLlm";
import { costOf, PRICES } from "../../src/domain/style/llm/CostLedger";
import type { HttpClient } from "../../src/application/ports/HttpClient";

/** Talks to the real API. Runs only with ANTHROPIC_API_KEY set: ANTHROPIC_API_KEY=… npx vitest run tests/integration */
const key = process.env.ANTHROPIC_API_KEY ?? "";
const model = (process.env.CLAUDE_MODEL as "claude-opus-5" | "claude-haiku-4-5" | undefined) ?? "claude-opus-5";

const fetchHttp: HttpClient = {
  async postJson(url, body, headers, signal) {
    const r = await fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers }, signal });
    return { status: r.status, json: await r.json() };
  },
};

const PARAGRAPH =
  "At the end of the day, the letter was written very slowly by a man who had started to realise that he was really quite tired. " +
  "A flood of memories washed over him, and his heart pounded in his chest like a drum. The silence bruised him. " +
  "\"I suppose it is what it is,\" he said quietly, and the garden, which was a diamond in the rough, seemed to shiver.";

describe.skipIf(!key)(`Claude live (${model})`, () => {
  it("returns validated findings; second call hits the prompt cache", async () => {
    const adapter = new ClaudeAnalyser(fetchHttp, { apiKey: key, model });
    const uc = new AnalyzeParagraphWithLlm(adapter, () => new Set(["cliche", "metaphor", "passive", "weak", "filter", "adverb"]));
    const out = await uc.analyse(PARAGRAPH, 0, new AbortController().signal);
    const first = adapter.lastUsage!;
    await uc.analyse(PARAGRAPH + " And then he left.", 0, new AbortController().signal);
    const second = adapter.lastUsage!;
    console.log(`\n${model}: ${out.length} findings; first call`, first, `$${costOf(first, PRICES[model]).toFixed(4)}; second`, second, `$${costOf(second, PRICES[model]).toFixed(4)}`);
    for (const f of out) console.log(`  [${f.kind}] "${PARAGRAPH.slice(f.from, f.to)}" — ${f.note}`);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.some((f) => f.kind === "cliche")).toBe(true);
    expect(second.cacheRead).toBeGreaterThan(0);
  }, 120_000);
});
