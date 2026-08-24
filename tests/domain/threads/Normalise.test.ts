import { describe, it, expect } from "vitest";
import { isAccumulative, normAttr, normValue, valuesConflict } from "../../../src/domain/threads/Normalise";

describe("normalising facts", () => {
  it("makes attributes comparable across spelling, plurals, articles and case", () => {
    expect(normAttr("Eye colour")).toBe("eye colour");
    expect(normAttr("eye color")).toBe("eye colour");
    expect(normAttr("Eyes")).toBe("eye");
    expect(normAttr("the hometown")).toBe("hometown");
    expect(normAttr("dress")).toBe("dress");
    expect(normAttr("Hair-colour!")).toBe("hair colour");
  });

  it("strips what the attribute already says out of the value", () => {
    expect(normValue("Green eyes", "eye colour")).toBe("green");
    expect(normValue("green", "eye colour")).toBe("green");
    expect(normValue("grey eyes", "Eyes")).toBe("grey");
    expect(normValue("eyes", "eyes")).toBe("eyes");
  });

  it("turns number words and ages into digits", () => {
    expect(normValue("twenty", "age")).toBe("20");
    expect(normValue("27 years old", "age")).toBe("27");
    expect(normValue("Seven yrs", "age")).toBe("7");
    expect(normValue("twenty-seven", "age")).toBe("20 7");
  });

  it("knows which attributes are lists rather than single values", () => {
    for (const a of ["owns", "Possessions", "knows about", "knows", "scars", "siblings", "weapon", "wears"]) expect(isAccumulative(a), a).toBe(true);
    for (const a of ["eye colour", "age", "birthplace", "alive or dead", "mother", "father's occupation", ""]) expect(isAccumulative(a), a).toBe(false);
  });

  it("flags a real disagreement, not a wordier restatement", () => {
    expect(valuesConflict("green", "grey", "eye colour")).toBe(true);
    expect(valuesConflict("green", "Green eyes", "eye colour")).toBe(false);
    expect(valuesConflict("tall", "very tall", "height")).toBe(false);
    expect(valuesConflict("20", "twenty", "age")).toBe(false);
    expect(valuesConflict("Bremen", "Lisbon", "hometown")).toBe(true);
    expect(valuesConflict("", "x")).toBe(false);
    expect(valuesConflict("alive", "dead", "alive or dead")).toBe(true);
  });
});
