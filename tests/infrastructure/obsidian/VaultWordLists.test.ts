import { describe, it, expect } from "vitest";
import { loadWordLists } from "../../../src/infrastructure/obsidian/VaultWordLists";

const files: Record<string, string> = {
  "Creative Writer/Bad words.md": "## Filtering\nfelt, saw",
  "Novel/Words.md": "## Tics\nreally",
};
const vault = {
  exists: async (p: string) => p in files,
  read: async (p: string) => files[p]!,
  resolveLink: (link: string, from: string) => (link === "Words" && from.startsWith("Novel/") ? "Novel/Words.md" : null),
};

describe("loadWordLists", () => {
  it("reads the vault-wide note and each project's own, and lists the notes it read", async () => {
    const { lists, paths } = await loadWordLists(vault, "Creative Writer/Bad words.md", [
      { scope: "Novel/", notePath: "Novel/Novel.md", wordsNote: "Words" },
      { scope: "Other/", notePath: "Other/Other.md" },
      { scope: "Lost/", notePath: "Lost/Lost.md", wordsNote: "Nowhere" },
    ]);
    expect(lists.vault[0]!.terms).toEqual(["felt", "saw"]);
    expect(Object.keys(lists.byScope)).toEqual(["Novel/"]);
    expect(lists.byScope["Novel/"]![0]!.name).toBe("Tics");
    expect(paths).toEqual(["Creative Writer/Bad words.md", "Novel/Words.md"]);
  });
  it("treats a missing vault-wide note as an empty list", async () => {
    const { lists, paths } = await loadWordLists(vault, "Missing.md", []);
    expect(lists.vault).toEqual([]);
    expect(paths).toEqual([]);
  });
});
