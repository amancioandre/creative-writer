import { type App, Modal } from "obsidian";
import type { NoteKind } from "../../domain/release/ReleaseNote";
import { ASK, FORM_URL, GUIDE_URL, RELEASE_URL, UPDATE, WELCOME } from "../../domain/release/notes";

/** How the modal reaches the browser; the plugin passes `window.open`, tests a spy. */
export type OpenUrl = (url: string) => void;

/**
 * The release note. Obsidian's own modal: its title, its button row, its
 * accent button. Every button closes it; the seen version was written
 * before it opened, so closing is all there is to dismissing.
 */
export class ReleaseNoteModal extends Modal {
  constructor(app: App, private readonly kind: NoteKind, private readonly version: string, private readonly openUrl: OpenUrl) {
    super(app);
  }

  onOpen(): void {
    const copy = this.kind === "welcome" ? WELCOME : UPDATE;
    const [major, minor] = this.version.split(".");
    this.setTitle(this.kind === "welcome" ? "Creative Writer" : `Creative Writer ${major}.${minor}`);
    this.modalEl.addClass("czm-rn");

    const body = this.contentEl.createDiv({ cls: "czm-rn-body" });
    body.createDiv({ cls: "czm-rn-headline", text: copy.headline });
    const list = body.createEl("ul", { cls: "czm-rn-list" });
    for (const bullet of copy.bullets) list.createEl("li", { text: bullet });
    body.createEl("p", { cls: "czm-rn-ask", text: ASK });

    const row = this.contentEl.createDiv({ cls: "modal-button-container" });
    row.createSpan({ cls: "czm-rn-foot", text: "Shown once per update · Settings → Where it runs" });
    row.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
    const second = this.kind === "welcome"
      ? { text: "Read the guide", url: GUIDE_URL }
      : { text: "What changed", url: RELEASE_URL(this.version) };
    row.createEl("button", { text: second.text }).addEventListener("click", () => { this.openUrl(second.url); this.close(); });
    row.createEl("button", { text: "Tell me how it goes", cls: "mod-cta" }).addEventListener("click", () => { this.openUrl(FORM_URL); this.close(); });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
