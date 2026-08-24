import { describe, it, expect } from "vitest";
import { CompromiseTagger } from "../../../src/infrastructure/nlp/CompromiseTagger";
import { looksLikeName } from "../../../src/domain/story/BuildGraph";

/** The words that polluted a real story map on 2026-08-24, checked against the real tagger. */
describe("candidate veto with compromise", () => {
  const tagger = new CompromiseTagger();
  it("rejects the impostors", () => {
    for (const w of ["He", "If", "Can", "This", "Its", "His", "You", "All", "How", "There", "Here", "Me", "Do", "Yeah", "Thank", "Twelve", "Better", "Waiting", "Disgusting", "Stand", "Write", "Ask", "LOW", "POV"]) {
      expect(looksLikeName(w, tagger), w).toBe(false);
    }
  });
  it("keeps the cast, the places and the gear", () => {
    for (const w of ["André", "Matt", "Lee", "Vitaliy", "Zak", "McCarthy", "Tikka", "Sako", "Leupold", "Vancouver Island", "Lee's Tundra", "Mora Garberg", "Bear", "Mountain", "Night", "Bedroom", "Road"]) {
      expect(looksLikeName(w, tagger), w).toBe(true);
    }
  });
});
