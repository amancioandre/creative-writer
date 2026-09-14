import type { Menu } from "obsidian";
import { LENSES, LENS_LABELS, toggleLens, type Lens } from "../../domain/lens/Lens";
import type { PluginSettings } from "../../domain/settings/Settings";
import type { CommandId } from "./commands";
import { buildMenu, type MenuEntry } from "./views/PanelShell";

/** What the lens menu needs from the host: the settings now, and a way to change them. */
export interface LensMenuPort {
  current(): PluginSettings;
  update(next: PluginSettings): void;
}

const COMMAND_OF: Readonly<Record<Lens, CommandId | undefined>> = { none: "lens-off", style: "lens-style", dialogue: "lens-dialogue", words: "lens-words", accents: "lens-accents" };

/**
 * The status-bar item's menu: one row per lens, the one on ticked, each
 * naming its command; then the two switches that shape a lens. The
 * rhythm row is greyed under the lenses that colour by speaker, which
 * hide the rhythm tint regardless.
 */
export function lensMenuEntries(port: LensMenuPort): (MenuEntry | "-")[] {
  const s = port.current();
  const bySpeaker = s.lens === "dialogue" || s.lens === "accents";
  const rows: (MenuEntry | "-")[] = LENSES.map((lens) => ({
    label: LENS_LABELS[lens],
    command: COMMAND_OF[lens],
    checked: s.lens === lens,
    onClick: () => port.update({ ...port.current(), lens: lens === "none" ? "none" : toggleLens(port.current().lens, lens) }),
  }));
  rows.push("-");
  rows.push({
    label: bySpeaker ? "Rhythm tint underneath (off under this lens)" : "Rhythm tint underneath",
    checked: !bySpeaker && s.rhythmUnderLens,
    disabled: s.lens === "none" || bySpeaker,
    onClick: () => { const c = port.current(); port.update({ ...c, rhythmUnderLens: !c.rhythmUnderLens }); },
  });
  rows.push({
    label: "Dim narration",
    checked: s.dialogue.dimNarration,
    disabled: !bySpeaker,
    onClick: () => { const c = port.current(); port.update({ ...c, dialogue: { ...c.dialogue, dimNarration: !c.dialogue.dimNarration } }); },
  });
  return rows;
}

export function lensMenu(port: LensMenuPort): Menu {
  return buildMenu(lensMenuEntries(port));
}
