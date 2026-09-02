import { describe, it, expect, afterEach } from "vitest";
import { mount, type Harness } from "./helpers";
import { commentTagExtension, TAG_CLASS } from "../../../src/infrastructure/codemirror/commentTagExtension";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

const marks = () => Array.from(h!.view.dom.querySelectorAll<HTMLElement>(`.${TAG_CLASS}`)).map((el) => [el.textContent, el.style.getPropertyValue("--czm-tag").trim()]);

describe("commentTagExtension", () => {
  it("marks the tag word inside a comment, coloured from settings", () => {
    h = mount("Marta %% TODO: cut this %% woke. %% CHECK: the coat %% %% ZZZ: unknown %%", commentTagExtension());
    expect(marks()).toEqual([["TODO", "#d9a621"], ["CHECK", "#4a8fe2"], ["ZZZ", ""]]);
  });

  it("leaves a TODO in dialogue and a lowercase tag alone", () => {
    h = mount("\"TODO: nothing,\" she said. %% todo: lowercase %%", commentTagExtension());
    expect(marks()).toEqual([]);
  });

  it("follows the setting and the document", () => {
    h = mount("%% FIX: x %%", commentTagExtension());
    expect(marks()).toHaveLength(1);
    h.setSettings({ manuscript: { ...DEFAULT_SETTINGS.manuscript, tintTags: false } });
    expect(marks()).toHaveLength(0);
    h.setSettings({ manuscript: DEFAULT_SETTINGS.manuscript });
    h.moveCursor(h.view.state.doc.length);
    h.type(" %% IDEA: y %%");
    expect(marks().map(([t]) => t)).toEqual(["FIX", "IDEA"]);
  });
});
