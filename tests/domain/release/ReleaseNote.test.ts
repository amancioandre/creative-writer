import { describe, it, expect } from "vitest";
import { parseVersion, releaseNoteDecision } from "../../../src/domain/release/ReleaseNote";
import { FORM_URL, GUIDE_URL, RELEASE_URL, UPDATE, WELCOME } from "../../../src/domain/release/notes";

describe("releaseNoteDecision", () => {
  it("a fresh install gets the welcome note and the seen version moves to the current one", () => {
    expect(releaseNoteDecision("", "0.11.0", true)).toEqual({ kind: "welcome", seen: "0.11.0" });
  });
  it("a minor or major step gets the update note", () => {
    expect(releaseNoteDecision("0.10.1", "0.11.0", true)).toEqual({ kind: "update", seen: "0.11.0" });
    expect(releaseNoteDecision("0.11.3", "1.0.0", true)).toEqual({ kind: "update", seen: "1.0.0" });
  });
  it("a patch step shows nothing but still advances the seen version", () => {
    expect(releaseNoteDecision("0.11.0", "0.11.1", true)).toEqual({ kind: null, seen: "0.11.1" });
    expect(releaseNoteDecision("0.11.1", "0.11.1", true)).toEqual({ kind: null, seen: "0.11.1" });
  });
  it("the switch off shows nothing, whatever the versions, and the seen version still moves", () => {
    expect(releaseNoteDecision("", "0.11.0", false)).toEqual({ kind: null, seen: "0.11.0" });
    expect(releaseNoteDecision("0.10.0", "0.11.0", false)).toEqual({ kind: null, seen: "0.11.0" });
  });
  it("a seen version ahead of the running one (downgrade, or a synced data.json) is left alone", () => {
    expect(releaseNoteDecision("0.12.0", "0.11.0", true)).toEqual({ kind: null, seen: "0.12.0" });
  });
  it("never guesses on junk: an unparsable current version does nothing; a junk seen value is healed", () => {
    expect(releaseNoteDecision("0.10.0", "dev", true)).toEqual({ kind: null, seen: "0.10.0" });
    expect(releaseNoteDecision("garbage", "0.11.0", true)).toEqual({ kind: null, seen: "0.11.0" });
  });
  it("parses plain and v-prefixed semver, nothing else", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2.3-beta.1")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2")).toBeNull();
  });
});

describe("the note's copy", () => {
  it("keeps to three bullets", () => {
    expect(WELCOME.bullets.length).toBeLessThanOrEqual(3);
    expect(UPDATE.bullets.length).toBeLessThanOrEqual(3);
  });
  it("every link is https and carries nothing about the writer: no query string, no fragment", () => {
    for (const url of [FORM_URL, GUIDE_URL, RELEASE_URL("0.11.0")]) {
      expect(url.startsWith("https://")).toBe(true);
      expect(url).not.toMatch(/[?#]/);
    }
  });
});
