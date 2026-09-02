import { describe, it, expect } from "vitest";
import { VaultWriterTags, type TagVaultLike } from "../../../src/infrastructure/obsidian/VaultWriterTags";

function fake(fm: Record<string, unknown>, text: string) {
  const state = { fm, text };
  const vault: TagVaultLike = {
    processFrontMatter: async (_p, change) => { change(state.fm); },
    process: async (_p, change) => { state.text = change(state.text); },
  };
  return { state, tags: new VaultWriterTags(vault) };
}

describe("VaultWriterTags", () => {
  it("replaces a front matter tag in place, any case, keeping the others", async () => {
    const { state, tags } = fake({ tags: ["Writer/Theme", "personal"] }, "body #writer/theme");
    await tags.retag("n.md", "writer", "theme", "archetype");
    expect(state.fm.tags).toEqual(["personal", "writer/archetype"]);
    expect(state.text).toBe("body #writer/theme");
  });
  it("removes a front matter tag and drops an emptied key, reading a string list under `tag` too", async () => {
    const { state, tags } = fake({ tag: "writer/theme, writer/quote" }, "");
    await tags.retag("n.md", "writer", "theme", null);
    expect(state.fm.tag).toEqual(["writer/quote"]);
    await tags.retag("n.md", "writer", "quote", null);
    expect("tag" in state.fm).toBe(false);
  });
  it("adds a tag to the front matter, creating the key, without duplicating one already there", async () => {
    const { state, tags } = fake({}, "");
    await tags.retag("n.md", "writer", null, "theme");
    expect(state.fm.tags).toEqual(["writer/theme"]);
    await tags.retag("n.md", "writer", null, "theme");
    expect(state.fm.tags).toEqual(["writer/theme"]);
  });
  it("edits an inline tag in the text when the front matter has none, and leaves lookalikes alone", async () => {
    const { state, tags } = fake({ tags: ["personal"] }, "One #writer/theme two #writer/theme-dark #writer/themes\n#Writer/theme");
    await tags.retag("n.md", "writer", "theme", "world");
    expect(state.text).toBe("One #writer/world two #writer/theme-dark #writer/themes\n#writer/world");
    expect(state.fm.tags).toEqual(["personal"]);
    await tags.retag("n.md", "writer", "world", null);
    expect(state.text).toBe("One two #writer/theme-dark #writer/themes\n");
  });
  it("falls back to the front matter when the tag to replace is nowhere", async () => {
    const { state, tags } = fake({}, "plain");
    await tags.retag("n.md", "writer", "theme", "world");
    expect(state.fm.tags).toEqual(["writer/world"]);
    expect(state.text).toBe("plain");
    await tags.retag("n.md", "writer", null, null);
    expect(state.fm.tags).toEqual(["writer/world"]);
  });
});
