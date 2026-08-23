import { describe, it, expect } from "vitest";
import { OllamaAnalyser } from "../../src/infrastructure/llm/OllamaAnalyser";
import { AnalyzeParagraphWithLlm } from "../../src/application/use-cases/AnalyzeParagraphWithLlm";
import type { HttpClient } from "../../src/application/ports/HttpClient";

/**
 * Talks to a real Ollama. Run with:  OLLAMA_LIVE=1 npx vitest run tests/integration
 * Skipped otherwise so the suite stays hermetic.
 */
const live = process.env.OLLAMA_LIVE === "1";
const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

const fetchHttp: HttpClient = {
  async postJson(url, body, headers, signal) {
    const r = await fetch(url, { method: "POST", body: JSON.stringify(body), headers, signal });
    return { status: r.status, json: await r.json() };
  },
};

const PARAGRAPH =
  "At the end of the day, the letter was written very slowly by a man who had started to realise that he was really quite tired. " +
  "A flood of memories washed over him, and his heart pounded in his chest like a drum. The silence bruised him. " +
  "\"I suppose it is what it is,\" he said quietly, and the garden, which was a diamond in the rough, seemed to shiver.";

describe.skipIf(!live)(`Ollama live (${model})`, () => {
  it("returns validated findings for a cliché-heavy paragraph within a sane time", async () => {
    const adapter = new OllamaAnalyser(fetchHttp, { baseUrl: "http://localhost:11434", model });
    const uc = new AnalyzeParagraphWithLlm(adapter, () => new Set(["cliche", "metaphor", "passive", "weak", "filter", "adverb"]));
    const t0 = performance.now();
    const out = await uc.analyse(PARAGRAPH, 0, new AbortController().signal);
    const ms = performance.now() - t0;
    console.log(`\n${model}: ${out.length} findings in ${Math.round(ms)} ms; usage`, adapter.lastUsage);
    for (const f of out) console.log(`  [${f.kind}] "${PARAGRAPH.slice(f.from, f.to)}" — ${f.note}`);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.some((f) => f.kind === "cliche")).toBe(true);
    for (const f of out) expect(PARAGRAPH.slice(f.from, f.to).trim().length).toBeGreaterThan(0);
  }, 120_000);
});
