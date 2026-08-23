import { describe, it, expect } from "vitest";
import { AnalyzeParagraphWithLlm } from "../../src/application/use-cases/AnalyzeParagraphWithLlm";
import type { LlmAnalyser, LlmRequest } from "../../src/application/ports/LlmAnalyser";

const fake = (reply: unknown[]): LlmAnalyser & { requests: LlmRequest[] } => ({
  name: "fake",
  requests: [],
  async analyse(r) { this.requests.push(r); return reply; },
});

describe("AnalyzeParagraphWithLlm", () => {
  it("asks only for the enabled kinds and returns validated, absolute findings", async () => {
    const llm = fake([{ kind: "metaphor", quote: "silence bruised", note: "x" }, { kind: "cliche", quote: "nowhere", note: "y" }]);
    const uc = new AnalyzeParagraphWithLlm(llm, () => new Set(["metaphor", "cliche"]));
    const out = await uc.analyse("The silence bruised him.", 100, new AbortController().signal);
    expect(llm.requests[0]!.checks).toEqual(["metaphor", "cliche"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "metaphor", from: 104, to: 119 });
  });

  it("skips the model entirely when no kinds are enabled", async () => {
    const llm = fake([]);
    const uc = new AnalyzeParagraphWithLlm(llm, () => new Set());
    expect(await uc.analyse("x", 0, new AbortController().signal)).toEqual([]);
    expect(llm.requests).toHaveLength(0);
  });

  it("skips very short paragraphs (not worth a model call)", async () => {
    const llm = fake([]);
    const uc = new AnalyzeParagraphWithLlm(llm, () => new Set(["cliche"]), { minWords: 5 });
    expect(await uc.analyse("Too short.", 0, new AbortController().signal)).toEqual([]);
    expect(llm.requests).toHaveLength(0);
  });

  it("drops findings of kinds that were not requested even if the model returns them", async () => {
    const llm = fake([{ kind: "weak", quote: "very", note: "x" }]);
    const uc = new AnalyzeParagraphWithLlm(llm, () => new Set(["cliche"]));
    expect(await uc.analyse("It was very cold in the hall that night.", 0, new AbortController().signal)).toEqual([]);
  });
});
