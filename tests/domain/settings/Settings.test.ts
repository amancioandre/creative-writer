import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, enabledStyleKinds, normalizeNotePath, normalizeSettings, tagsToText, textToTags } from "../../../src/domain/settings/Settings";

describe("normalizeSettings", () => {
  it("returns defaults for undefined input", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("fills missing keys from defaults and keeps provided ones", () => {
    const s = normalizeSettings({ typewriterEnabled: false });
    expect(s.typewriterEnabled).toBe(false);
    expect(s.focusFadeEnabled).toBe(DEFAULT_SETTINGS.focusFadeEnabled);
  });

  it("clamps rhythm tier count into 4..6", () => {
    expect(normalizeSettings({ rhythmTiers: 1 }).rhythmTiers).toBe(4);
    expect(normalizeSettings({ rhythmTiers: 99 }).rhythmTiers).toBe(6);
    expect(normalizeSettings({ rhythmTiers: 5.7 }).rhythmTiers).toBe(5);
  });

  it("ignores unknown keys and wrong types", () => {
    const s = normalizeSettings({ bogus: 1, typewriterEnabled: "yes" });
    expect((s as unknown as Record<string, unknown>).bogus).toBeUndefined();
    expect(s.typewriterEnabled).toBe(DEFAULT_SETTINGS.typewriterEnabled);
  });
});

describe("style settings", () => {
  it("defaults every style check on and the feature on", () => {
    const s = normalizeSettings(undefined);
    expect(s.lens).toBe("style");
    expect(s.styleChecks).toEqual({ cliche: true, passive: true, filter: true, adverb: true, repetition: true, metaphor: true, nominalization: true, weakverb: true });
  });
  it("merges partial styleChecks with defaults and drops junk", () => {
    const s = normalizeSettings({ styleChecks: { passive: false, bogus: true, adverb: "no" } });
    expect(s.styleChecks.passive).toBe(false);
    expect(s.styleChecks.adverb).toBe(true);
    expect((s.styleChecks as Record<string, unknown>).bogus).toBeUndefined();
  });
});

describe("llm settings", () => {
  it("defaults to off with sensible Ollama values", () => {
    const s = normalizeSettings(undefined);
    expect(s.llm).toEqual({ provider: "off", onIdle: false, idleMs: 1500, ollamaUrl: "http://localhost:11434", ollamaModel: "qwen2.5:7b", ollamaEmbedModel: "nomic-embed-text", claudeModel: "claude-opus-5", claudeApiKey: "", dailyCapUsd: 1, spend: { day: "", usd: 0 } });
  });
  it("accepts valid providers and rejects junk", () => {
    expect(normalizeSettings({ llm: { provider: "ollama" } }).llm.provider).toBe("ollama");
    expect(normalizeSettings({ llm: { provider: "gpt" } }).llm.provider).toBe("off");
  });
  it("clamps idleMs and keeps strings", () => {
    const s = normalizeSettings({ llm: { idleMs: 10, ollamaUrl: "http://h:1", ollamaModel: "m" } });
    expect(s.llm.idleMs).toBe(500);
    expect(s.llm.ollamaUrl).toBe("http://h:1");
    expect(s.llm.ollamaModel).toBe("m");
  });
  it("validates claude fields", () => {
    const s = normalizeSettings({ llm: { provider: "claude", claudeModel: "claude-haiku-4-5", claudeApiKey: " sk ", dailyCapUsd: 500, spend: { day: "2026-08-23", usd: -1 } } });
    expect(s.llm.provider).toBe("claude");
    expect(s.llm.claudeModel).toBe("claude-haiku-4-5");
    expect(s.llm.claudeApiKey).toBe("sk");
    expect(s.llm.dailyCapUsd).toBe(100);
    expect(s.llm.spend).toEqual({ day: "2026-08-23", usd: 0 });
    expect(normalizeSettings({ llm: { claudeModel: "claude-3" } }).llm.claudeModel).toBe("claude-opus-5");
  });
});

describe("normalizeNotePath", () => {
  it("cleans a vault-relative markdown path", () => {
    expect(normalizeNotePath(" /Creative Writer\\Writing log ")).toBe("Creative Writer/Writing log.md");
    expect(normalizeNotePath("a//b.MD")).toBe("a/b.MD");
    expect(normalizeNotePath("")).toBeNull();
    expect(normalizeNotePath("folder/")).toBeNull();
    expect(normalizeNotePath(3)).toBeNull();
    expect(normalizeSettings({ goals: { logNote: "" } }).goals.logNote).toBe("Creative Writer/Writing log.md");
    expect(normalizeSettings({ goals: { logNote: "Logs/me" } }).goals.logNote).toBe("Logs/me.md");
  });
});

describe("normalizeSettings — story map", () => {
  it("defaults, clamps forces, validates colours and keeps flags", () => {
    const s = normalizeSettings({ storyMap: { layers: { external: false, bogus: true }, kinds: { note: true }, hideIsolated: true, forces: { repulsion: 99, linkDistance: "x", gravity: -1 }, colors: { character: "#ABCDEF", location: "red" }, panelOpen: false } });
    expect(s.storyMap.layers).toEqual({ explicit: true, internal: true, external: false });
    expect(s.storyMap.kinds.note).toBe(true);
    expect(s.storyMap.hideIsolated).toBe(true);
    expect(s.storyMap.forces).toEqual({ repulsion: 4, linkDistance: 90, linkStrength: 0.5, gravity: 0 });
    expect(s.storyMap.colors.character).toBe("#abcdef");
    expect(s.storyMap.colors.location).toBe(DEFAULT_SETTINGS.storyMap.colors.location);
    expect(s.storyMap.panelOpen).toBe(false);
    expect(normalizeSettings({ storyMap: { display: { nodeSize: 9, labelSize: -2, edgeOpacity: "x" } } }).storyMap.display).toEqual({ nodeSize: 2.5, edgeWidth: 1, edgeOpacity: 0.55, labelSize: 0 });
    expect(normalizeSettings({}).storyMap).toEqual(DEFAULT_SETTINGS.storyMap);
    expect(normalizeSettings({}).threads).toEqual(DEFAULT_SETTINGS.threads);
    const t = normalizeSettings({ threads: { kinds: { entity: true, bogus: 1 }, strips: { cast: false, "": true, x: "no" }, showDismissed: true, contradictionsOnly: "yes", panelOpen: false } }).threads;
    expect(t).toEqual({ kinds: { entity: true, fact: true, writer: true, echo: false }, echoSensitivity: "medium", strips: { cast: false }, showDismissed: true, contradictionsOnly: false, panelOpen: false, sections: {} });
    expect(normalizeSettings({ threads: { sections: { filters: false, strips: true, "": true, x: "no" } } }).threads.sections).toEqual({ filters: false, strips: true });
    expect(normalizeSettings({ threads: { echoSensitivity: "high" } }).threads.echoSensitivity).toBe("high");
    expect(normalizeSettings({ threads: { echoSensitivity: "loud" } }).threads.echoSensitivity).toBe("medium");
  });
});

describe("manuscript settings", () => {
  it("defaults to two folder levels, titles on, the numeric prefix pattern, demotion on and everything shown", () => {
    const m = normalizeSettings(undefined).manuscript;
    expect(m).toMatchObject({ folderDepth: 2, noteTitles: true, stripPrefix: "^\\d+[\\s._)-]*", demoteHeadings: true, proseOnly: false, showComments: true, tintTags: true, showRuler: true, showStory: false, readingSpeed: 250, showEchoes: false });
    expect(normalizeSettings({ manuscript: { showEchoes: true } }).manuscript.showEchoes).toBe(true);
    expect(normalizeSettings({ manuscript: { showStory: true, showRuler: "no" } }).manuscript).toMatchObject({ showStory: true, showRuler: true });
    expect(m.tags.map((t) => t.name)).toEqual(["TODO", "FIX", "CHECK", "IDEA", "CUT", "REF"]);
  });
  it("clamps the depth, keeps any pattern string and falls back on wrong types", () => {
    const m = normalizeSettings({ manuscript: { folderDepth: 40, stripPrefix: "(", noteTitles: "no", proseOnly: true } }).manuscript;
    expect(m.folderDepth).toBe(6);
    expect(m.stripPrefix).toBe("(");
    expect(m.noteTitles).toBe(true);
    expect(m.proseOnly).toBe(true);
    expect(normalizeSettings({ manuscript: { folderDepth: -3 } }).manuscript.folderDepth).toBe(0);
  });
  it("keeps the reading speed between 100 and 600 words a minute", () => {
    expect(normalizeSettings({ manuscript: { readingSpeed: 300 } }).manuscript.readingSpeed).toBe(300);
    expect(normalizeSettings({ manuscript: { readingSpeed: 5 } }).manuscript.readingSpeed).toBe(100);
    expect(normalizeSettings({ manuscript: { readingSpeed: 9000 } }).manuscript.readingSpeed).toBe(600);
    expect(normalizeSettings({ manuscript: { readingSpeed: "fast" } }).manuscript.readingSpeed).toBe(250);
  });
  it("normalises tags: uppercase names, hex colours, no duplicates, a text round trip", () => {
    const tags = normalizeSettings({ manuscript: { tags: [{ name: "todo", color: "#ABCDEF" }, { name: "x" }, { name: "TODO", color: "#000000" }, { name: "NOTE", color: "red" }, 3] } }).manuscript.tags;
    expect(tags).toEqual([{ name: "TODO", color: "#abcdef" }, { name: "NOTE", color: "#8a8a8a" }, { name: "REF", color: "#d08c60" }]);
    expect(textToTags(tagsToText(tags))).toEqual(tags);
    expect(textToTags("CHECK #4a8fe2\nfix\n\n")).toEqual([{ name: "CHECK", color: "#4a8fe2" }, { name: "FIX", color: "#8a8a8a" }, { name: "REF", color: "#d08c60" }]);
    expect(textToTags("REF #000000").map((t) => t.color)).toEqual(["#000000"]);
  });
});

describe("writer settings", () => {
  it("defaults to no stories folder and normalises one to a bare vault-relative path", () => {
    expect(normalizeSettings(undefined).writer).toEqual({ storiesFolder: "", panelOpen: true, sections: {} });
    expect(normalizeSettings({ writer: { sections: { layers: true } } }).writer.sections).toEqual({ layers: true });
    expect(normalizeSettings({ writer: { panelOpen: false } }).writer.panelOpen).toBe(false);
    expect(normalizeSettings({ writer: { storiesFolder: " /storytelling\\stories/ " } }).writer.storiesFolder).toBe("storytelling/stories");
    expect(normalizeSettings({ writer: { storiesFolder: 3 } }).writer.storiesFolder).toBe("");
  });

  it("normalises the plot grid's layout", async () => {
    const { normalizePlotGrid, DEFAULT_PLOT_GRID } = await import("../../../src/domain/settings/Settings");
    expect(normalizePlotGrid(undefined)).toEqual(DEFAULT_PLOT_GRID);
    expect(normalizePlotGrid({ panelOpen: false, castExpanded: true, folded: { arc: true, bogus: true }, hidden: { "Novel/": ["Time", 3, " "], "Other/": [] }, unmoved: false, sections: { "pg-cell": false, x: "no" } }))
      .toEqual({ panelOpen: false, castExpanded: true, folded: { arc: true, theme: false, subplot: false, free: false }, hidden: { "Novel/": ["Time"] }, unmoved: false, sections: { "pg-cell": false } });
  });
});

describe("lens settings", () => {
  it("defaults to the style lens with the rhythm tint underneath and a word list note", () => {
    const s = normalizeSettings(undefined);
    expect(s.lens).toBe("style");
    expect(s.rhythmUnderLens).toBe(true);
    expect(s.words.note).toBe("Creative Writer/Bad words.md");
  });
  it("keeps a saved lens and drops an unknown one", () => {
    expect(normalizeSettings({ lens: "words" }).lens).toBe("words");
    expect(normalizeSettings({ lens: "sepia" }).lens).toBe("style");
  });
  it("reads the old style switch: off stays off, on becomes the style lens", () => {
    expect(normalizeSettings({ styleEnabled: false }).lens).toBe("none");
    expect(normalizeSettings({ styleEnabled: true }).lens).toBe("style");
  });
  it("normalises the word list note path and falls back to the default", () => {
    expect(normalizeSettings({ words: { note: "Lists/Words" } }).words.note).toBe("Lists/Words.md");
    expect(normalizeSettings({ words: { note: "  " } }).words.note).toBe("Creative Writer/Bad words.md");
  });
  it("only the style lens enables style kinds", () => {
    expect(enabledStyleKinds(normalizeSettings({ lens: "words" })).size).toBe(0);
    expect(enabledStyleKinds(normalizeSettings({ lens: "style" })).size).toBe(8);
  });
});

describe("dialogue settings", () => {
  it("defaults to double quotes, whole-paragraph italics and dimmed narration", () => {
    expect(normalizeSettings(undefined).dialogue).toEqual({ marks: "double", thoughts: "italic-paragraph", thoughtPattern: "", dimNarration: true, speakerColours: true });
  });
  it("keeps known marks and drops unknown ones", () => {
    const s = normalizeSettings({ dialogue: { marks: "dash", thoughts: "custom", thoughtPattern: "~(.+)~", dimNarration: false, speakerColours: false } }).dialogue;
    expect(s).toEqual({ marks: "dash", thoughts: "custom", thoughtPattern: "~(.+)~", dimNarration: false, speakerColours: false });
    expect(normalizeSettings({ dialogue: { marks: "guillemets", thoughts: "loud" } }).dialogue.marks).toBe("double");
    expect(normalizeSettings({ dialogue: { marks: "guillemets", thoughts: "loud" } }).dialogue.thoughts).toBe("italic-paragraph");
  });
});
