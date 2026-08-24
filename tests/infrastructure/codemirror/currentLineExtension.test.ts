import { describe, it, expect, afterEach } from "vitest";
import { bandFor, currentLineExtension, CURRENT_LINE_LAYER_CLASS } from "../../../src/infrastructure/codemirror/currentLineExtension";
import { mount, type Harness } from "./helpers";

describe("bandFor", () => {
  it("stretches the cursor's visual line across the scroller", () => {
    expect(bandFor({ top: 120, height: 24 }, 800)).toEqual({ top: 120, height: 24, width: 800 });
  });
  it("is null without layout", () => {
    expect(bandFor(null, 800)).toBeNull();
    expect(bandFor({ top: 0, height: 0 }, 800)).toBeNull();
    expect(bandFor({ top: 0, height: 24 }, 0)).toBeNull();
  });
});

describe("currentLineExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("mounts a below-text layer inside the scroller", () => {
    h = mount("one\ntwo", currentLineExtension());
    const layerEl = h.view.scrollDOM.querySelector<HTMLElement>(`.cm-layer.${CURRENT_LINE_LAYER_CLASS}`);
    expect(layerEl).not.toBeNull();
    expect(layerEl!.classList.contains("cm-layer-above")).toBe(false);
  });

  it("survives cursor moves and setting toggles without throwing", () => {
    h = mount("one\ntwo", currentLineExtension());
    h.moveCursor(5);
    h.setSettings({ currentLineEnabled: false });
    h.moveCursor(0);
    h.setSettings({ currentLineEnabled: true });
    expect(h.view.scrollDOM.querySelector(`.${CURRENT_LINE_LAYER_CLASS}`)).not.toBeNull();
  });
});

import { veilsFor, VEIL_LAYER_CLASS } from "../../../src/infrastructure/codemirror/currentLineExtension";

describe("veilsFor", () => {
  const row = { top: 40, height: 20, width: 800 };
  it("covers the paragraph above and below the cursor row", () => {
    expect(veilsFor({ top: 0, bottom: 100 }, row)).toEqual([
      { top: 0, height: 40, width: 800 },
      { top: 60, height: 40, width: 800 },
    ]);
  });
  it("emits nothing for a one-row paragraph", () => {
    expect(veilsFor({ top: 40, bottom: 60 }, row)).toEqual([]);
  });
  it("emits one band when the cursor is on the first or last row", () => {
    expect(veilsFor({ top: 40, bottom: 100 }, row)).toEqual([{ top: 60, height: 40, width: 800 }]);
    expect(veilsFor({ top: 0, bottom: 60 }, row)).toEqual([{ top: 0, height: 40, width: 800 }]);
  });
  it("mounts an above-text veil layer", () => {
    const h = mount("one\ntwo", currentLineExtension());
    const el = h.view.scrollDOM.querySelector<HTMLElement>(`.cm-layer.${VEIL_LAYER_CLASS}`);
    expect(el?.classList.contains("cm-layer-above")).toBe(true);
    h.destroy();
  });
});
