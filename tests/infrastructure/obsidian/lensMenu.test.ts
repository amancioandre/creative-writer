import { describe, it, expect } from "vitest";
import { lensMenu, lensMenuEntries } from "../../../src/infrastructure/obsidian/lensMenu";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../../src/domain/settings/Settings";

const port = (initial: Partial<PluginSettings> = {}) => {
  let s: PluginSettings = { ...DEFAULT_SETTINGS, ...initial };
  return { current: () => s, update: (n: PluginSettings) => { s = n; }, get settings() { return s; } };
};

describe("lens menu", () => {
  it("lists every lens with the one on ticked, each naming its command, then the two switches", () => {
    const p = port({ lens: "words" });
    const rows = lensMenuEntries(p);
    const labels = rows.map((r) => (r === "-" ? "-" : `${r.label}${r.checked ? " ✓" : ""}${r.command ? ` [${r.command}]` : ""}`));
    expect(labels).toEqual(["No lens [lens-off]", "Style checks [lens-style]", "Dialogue [lens-dialogue]", "Words ✓ [lens-words]", "Accents [lens-accents]", "-", "Rhythm tint underneath ✓", "Dim narration ✓"]);
    const menu = lensMenu(p);
    expect(menu.items.map((i) => i.title)).toContain("WordsLens: words");
  });
  it("a lens row switches to that lens, and switches it off when it is the one on; no lens is never a toggle", () => {
    const p = port({ lens: "style" });
    (lensMenuEntries(p)[3] as { onClick: () => void }).onClick();
    expect(p.settings.lens).toBe("words");
    (lensMenuEntries(p)[3] as { onClick: () => void }).onClick();
    expect(p.settings.lens).toBe("none");
    (lensMenuEntries(p)[0] as { onClick: () => void }).onClick();
    expect(p.settings.lens).toBe("none");
  });
  it("greys the rhythm row under no lens and under the speaker lenses, and the narration row elsewhere", () => {
    const off = lensMenuEntries(port({ lens: "none" }));
    expect((off[6] as { disabled?: boolean }).disabled).toBe(true);
    const dialogue = lensMenuEntries(port({ lens: "dialogue" }));
    expect((dialogue[6] as { disabled?: boolean; checked?: boolean; label: string })).toMatchObject({ disabled: true, checked: false, label: "Rhythm tint underneath (off under this lens)" });
    expect((dialogue[7] as { disabled?: boolean; checked?: boolean })).toMatchObject({ disabled: false, checked: true });
    const style = lensMenuEntries(port({ lens: "style" }));
    expect((style[6] as { disabled?: boolean })).toMatchObject({ disabled: false });
    expect((style[7] as { disabled?: boolean })).toMatchObject({ disabled: true });
  });
  it("the switches flip their setting", () => {
    const p = port({ lens: "dialogue" });
    (lensMenuEntries(p)[7] as { onClick: () => void }).onClick();
    expect(p.settings.dialogue.dimNarration).toBe(false);
    const q = port({ lens: "style" });
    (lensMenuEntries(q)[6] as { onClick: () => void }).onClick();
    expect(q.settings.rhythmUnderLens).toBe(false);
  });
});
