import { describe, it, expect } from "vitest";
import { OllamaMythAnalyser } from "../../src/infrastructure/llm/OllamaMythAnalyser";
import { AnalyzeMyth } from "../../src/application/use-cases/AnalyzeMyth";
import type { HttpClient } from "../../src/application/ports/HttpClient";

const live = process.env.OLLAMA_LIVE === "1";
const model = process.env.OLLAMA_MODEL ?? "deepseek-r1:14b";
const fetchHttp: HttpClient = {
  async postJson(url, body, headers, signal) {
    const r = await fetch(url, { method: "POST", body: JSON.stringify(body), headers, signal });
    return { status: r.status, json: await r.json() };
  },
};
const SCENE = `She waited until the house was asleep before she went down. The cellar door had not been opened since the funeral; the key was where he had always kept it, on the nail behind the clock, and it turned as if it had been oiled that morning. She carried the lamp he had left her. The stairs went further than she remembered. At the bottom there was the smell of apples and river water, and a table, and on the table the ledger with her own name in it, written in his hand, again and again, the dates running past the day he died. She did not come back up until it was light, and when she did, she had the ledger under her arm and did not tell her mother where she had been.`;

describe.skipIf(!live)(`myth live (${model})`, () => {
  it("produces a report with quoted evidence", async () => {
    const uc = new AnalyzeMyth(new OllamaMythAnalyser(fetchHttp, { baseUrl: "http://localhost:11434", model }));
    const t0 = performance.now();
    const r = await uc.execute(SCENE, new AbortController().signal);
    console.log(`\n${model} in ${Math.round(performance.now() - t0)} ms\n  summary: ${r.summary}\n  patterns: ${r.patterns.map((p) => `${p.name} ["${p.evidence}"] — ${p.note}`).join("\n            ")}\n  archetypes: ${r.archetypes.map((a) => `${a.name} (${a.character}) ["${a.evidence}"]`).join("; ")}\n  next: ${r.next}`);
    expect(r.isEmpty).toBe(false);
  }, 300_000);
});
