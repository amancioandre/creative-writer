import { describe, it, expect } from "vitest";
import { Menu } from "obsidian";
import { PanelShell, showOverflow } from "../../../src/infrastructure/obsidian/views/PanelShell";

describe("the ⋯ menu", () => {
  it("names each row's action and the command it also is, with toggles checked and unavailable rows disabled", () => {
    let fitted = 0;
    showOverflow(new MouseEvent("click"), [
      { label: "Fit the board", icon: "maximize", command: "writer-fit", onClick: () => { fitted++; } },
      "-",
      { label: "Comments pane", command: "manuscript-comments", checked: true, onClick: () => undefined },
      { label: "Show all", command: "story-map-show-all", disabled: true, onClick: () => undefined },
    ]);
    const items = Menu.last!.items;
    expect(items.map((i) => i.title)).toEqual(["Fit the boardWriter: fit the board", "Comments paneManuscript: toggle the comments pane", "Show allStory map: show all (leave the focus)"]);
    expect(items.map((i) => i.checked)).toEqual([null, true, null]);
    expect(items.map((i) => i.disabled)).toEqual([false, false, true]);
    items[0]!.cb();
    expect(fitted).toBe(1);
  });

  it("sits in the shell's head before the side toggle and builds its rows at each click", () => {
    const host = document.body.createDiv();
    let open = false;
    const shell = new PanelShell(host, { current: "map", jump: () => undefined, side: { isOpen: () => open, onToggle: () => { open = !open; } } });
    let n = 0;
    shell.overflow(() => [{ label: `Row ${++n}`, onClick: () => undefined }]);
    const fixed = [...host.querySelectorAll(".czm-shell-fixed button")].map((b) => b.getAttribute("aria-label"));
    expect(fixed).toEqual(["More actions", "Toggle panel"]);
    const more = host.querySelector<HTMLButtonElement>(".czm-shell-more")!;
    more.click();
    expect(Menu.last!.items[0]!.title).toBe("Row 1");
    more.click();
    expect(Menu.last!.items[0]!.title).toBe("Row 2");
  });
});
