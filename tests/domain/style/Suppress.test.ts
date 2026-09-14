import { describe, it, expect } from "vitest";
import { KIND_PHRASES, suppressComment, suppressedKinds } from "../../../src/domain/style/Suppress";
import { FINDING_KINDS } from "../../../src/domain/style/Finding";

describe("suppression comments", () => {
  it("reads every `%% not kind %%` in a paragraph, whatever the case", () => {
    expect([...suppressedKinds("At the end of the day. %% not cliche %% Then %% NOT passive %%")]).toEqual(["cliche", "passive"]);
    expect(suppressedKinds("nothing here").size).toBe(0);
  });
  it("writes the comment the reader will find again, and has a phrase for every kind", () => {
    expect(suppressedKinds(suppressComment("adverb")).has("adverb")).toBe(true);
    for (const k of FINDING_KINDS) expect(KIND_PHRASES[k]).toBeTruthy();
  });
});
