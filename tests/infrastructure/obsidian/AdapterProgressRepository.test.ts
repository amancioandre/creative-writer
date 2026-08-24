import { describe, it, expect } from "vitest";
import { AdapterProgressRepository } from "../../../src/infrastructure/obsidian/AdapterProgressRepository";
import { EMPTY_LOG } from "../../../src/domain/progress/WritingLog";

function fakeAdapter(files: Record<string, string> = {}) {
  return {
    files,
    async exists(p: string) { return p in files; },
    async read(p: string) { return files[p]!; },
    async write(p: string, d: string) { files[p] = d; },
  };
}

describe("AdapterProgressRepository", () => {
  it("returns the empty log when the file is missing or unreadable", async () => {
    expect(await new AdapterProgressRepository(fakeAdapter(), "p.json").load()).toEqual(EMPTY_LOG);
    expect(await new AdapterProgressRepository(fakeAdapter({ "p.json": "{not json" }), "p.json").load()).toEqual(EMPTY_LOG);
  });

  it("round-trips a log", async () => {
    const adapter = fakeAdapter();
    const repo = new AdapterProgressRepository(adapter, "p.json");
    const log = { days: { "2026-08-24": { added: 5, removed: 1, files: { "a.md": { added: 5, removed: 1 } } } }, counts: { "a.md": 40 } };
    await repo.save(log);
    expect(await repo.load()).toEqual(log);
  });
});
