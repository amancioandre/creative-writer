import { describe, it, expect } from "vitest";
import { CORPUS } from "../../eval/corpus";
import { score, formatScorecard } from "../../eval/score";
import { AnalyzeParagraphWithLlm } from "../../src/application/use-cases/AnalyzeParagraphWithLlm";
import { OllamaAnalyser } from "../../src/infrastructure/llm/OllamaAnalyser";
import { ClaudeAnalyser } from "../../src/infrastructure/llm/ClaudeAnalyser";
import type { LlmAnalyser } from "../../src/application/ports/LlmAnalyser";
import type { HttpClient } from "../../src/application/ports/HttpClient";
import { FINDING_KINDS, type FindingKind } from "../../src/domain/style/Finding";
import { MODEL_KINDS } from "../../src/application/use-cases/AnalyzeParagraphWithLlm";

/**
 * Model scorecards. Sentences are sent in batches of ~8 as one "paragraph"
 * to keep the call count sane; the validator maps quotes back to sentences.
 *
 *   OLLAMA_LIVE=1 npx vitest run tests/eval/model
 *   ANTHROPIC_API_KEY=… CLAUDE_MODEL=claude-haiku-4-5 npx vitest run tests/eval/model
 */
const fetchHttp: HttpClient = {
  async postJson(url, body, headers, signal) {
    const r = await fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers }, signal });
    return { status: r.status, json: await r.json() };
  },
};

async function run(llm: LlmAnalyser) {
  const uc = new AnalyzeParagraphWithLlm(llm, () => new Set(FINDING_KINDS), { minWords: 1 });
  const kinds = [...MODEL_KINDS];
  const detected = new Map<string, Set<FindingKind>>();
  const BATCH = Number(process.env.EVAL_BATCH ?? 8);
  for (let i = 0; i < CORPUS.length; i += BATCH) {
    const batch = CORPUS.slice(i, i + BATCH);
    const text = batch.map((b) => b.text).join("\n");
    const findings = await uc.analyse(text, 0, new AbortController().signal);
    let offset = 0;
    for (const item of batch) {
      const from = offset, to = offset + item.text.length;
      detected.set(item.text, new Set(findings.filter((f) => f.from < to && f.to > from).map((f) => f.kind)));
      offset = to + 1;
    }
  }
  return score(CORPUS, detected, kinds);
}

const ollama = process.env.OLLAMA_LIVE === "1";
const claudeKey = process.env.ANTHROPIC_API_KEY ?? "";

describe.skipIf(!ollama)("eval: ollama", () => {
  it("scorecard", async () => {
    const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
    const s = await run(new OllamaAnalyser(fetchHttp, { baseUrl: "http://localhost:11434", model }));
    console.log("\n" + formatScorecard(`Ollama ${model}`, s) + "\n");
    expect(s.micro.f1).toBeGreaterThan(0);
  }, 600_000);
});

describe.skipIf(!claudeKey)("eval: claude", () => {
  it("scorecard", async () => {
    const model = (process.env.CLAUDE_MODEL as "claude-opus-5" | "claude-haiku-4-5") ?? "claude-opus-5";
    const s = await run(new ClaudeAnalyser(fetchHttp, { apiKey: claudeKey, model }));
    console.log("\n" + formatScorecard(`Claude ${model}`, s) + "\n");
    expect(s.micro.f1).toBeGreaterThan(0);
  }, 600_000);
});
