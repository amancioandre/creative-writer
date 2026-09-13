import { describe, it, expect } from "vitest";
import { INTENT_CORPUS } from "../fixtures/intentCorpus";
import { OllamaIntentAnalyser } from "../../src/infrastructure/llm/OllamaIntentAnalyser";
import { validateIntent } from "../../src/domain/threads/Intent";
import type { HttpClient } from "../../src/application/ports/HttpClient";

/**
 * The intent reading's scorecard against a live local model:
 *
 *   OLLAMA_LIVE=1 OLLAMA_MODEL=qwen2.5:7b npx vitest run tests/eval/intent
 *
 * Accuracy over the labelled corpus is printed and must clear the bar
 * below; a prompt change that drops it fails here before it reaches a
 * card.
 */
const fetchHttp: HttpClient = {
  async postJson(url, body, headers, signal) {
    const r = await fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers }, signal });
    return { status: r.status, json: await r.json() };
  },
};

const live = process.env.OLLAMA_LIVE === "1";

describe.skipIf(!live)("eval: intent reading (ollama)", () => {
  it("names a reversal, an error and a paraphrase correctly on the corpus", async () => {
    const analyser = new OllamaIntentAnalyser(fetchHttp, { baseUrl: process.env.OLLAMA_URL ?? "http://localhost:11434", model: process.env.OLLAMA_MODEL ?? "qwen2.5:7b" });
    let right = 0;
    const rows: string[] = [];
    for (const { request, verdict } of INTENT_CORPUS) {
      const got = validateIntent(await analyser.analyse(request, new AbortController().signal));
      if (got?.verdict === verdict) right++;
      rows.push(`${got?.verdict === verdict ? "✓" : "✗"} ${request.subject} · ${request.attribute}: expected ${verdict}, got ${got?.verdict ?? "nothing"}${got?.reason ? ` — ${got.reason}` : ""}`);
    }
    const accuracy = right / INTENT_CORPUS.length;
    console.log(`intent reading: ${right}/${INTENT_CORPUS.length} (${(accuracy * 100).toFixed(0)}%)\n${rows.join("\n")}`);
    expect(accuracy).toBeGreaterThanOrEqual(0.66);
  }, 300_000);
});
