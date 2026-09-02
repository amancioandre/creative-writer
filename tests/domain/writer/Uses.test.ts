import { describe, it, expect } from "vitest";
import { isRecurring, refLinks, usesOf } from "../../../src/domain/writer/Uses";

describe("Uses", () => {
  it("reads REF comments in every link shape and nothing else", () => {
    const text = "Prose. %% REF: [[Invictus]] %% more %%REF:[[Courage#Line|shown]]%% %% CHECK: [[Not a ref]] %% %% ref: [[lowercase]] %% %% REF: [[Invictus]] %%";
    expect(refLinks(text)).toEqual(["Invictus", "Courage"]);
    expect(refLinks("nothing")).toEqual([]);
  });
  it("counts a story once per card, from links and from REFs, and names recurrence", () => {
    const resolve = (link: string) => ({ Invictus: "sources/Invictus.md", Courage: "notes/Courage.md" })[link] ?? null;
    const uses = usesOf(["sources/Invictus.md", "notes/Courage.md", "notes/Unused.md"], [
      { name: "The Bear Hunt", notes: [
        { path: "bh/One.md", links: ["notes/Courage.md", "bh/Two.md"], text: "%% REF: [[Invictus]] %%" },
        { path: "bh/Two.md", links: ["notes/Courage.md"], text: "" },
      ] },
      { name: "Whispering Horse", notes: [{ path: "wh/One.md", links: [], text: "%% REF: [[Courage]] %% %% REF: [[Nowhere]] %%" }] },
    ], resolve);
    expect(uses.get("notes/Courage.md")).toEqual(["The Bear Hunt", "Whispering Horse"]);
    expect(uses.get("sources/Invictus.md")).toEqual(["The Bear Hunt"]);
    expect(uses.has("notes/Unused.md")).toBe(false);
    expect(isRecurring(uses, "notes/Courage.md")).toBe(true);
    expect(isRecurring(uses, "sources/Invictus.md")).toBe(false);
    expect(isRecurring(uses, "notes/Unused.md")).toBe(false);
  });
});
