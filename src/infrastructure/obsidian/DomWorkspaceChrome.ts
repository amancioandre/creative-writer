import type { WorkspaceChrome } from "../../application/ports/WorkspaceChrome";

export const ZEN_BODY_CLASS = "czm-zen";

/**
 * Implements the chrome port against Obsidian's DOM. Hiding is done purely by
 * toggling a body class — styles.css decides what disappears — so the plugin
 * never reaches into Obsidian's workspace internals.
 */
export class DomWorkspaceChrome implements WorkspaceChrome {
  constructor(private readonly doc: Document) {}

  hideChrome(): void {
    this.doc.body.classList.add(ZEN_BODY_CLASS);
  }

  showChrome(): void {
    this.doc.body.classList.remove(ZEN_BODY_CLASS);
  }

  async enterFullscreen(): Promise<void> {
    const root = this.doc.documentElement;
    if (typeof root.requestFullscreen !== "function") return;
    await root.requestFullscreen();
  }

  async exitFullscreen(): Promise<void> {
    if (typeof this.doc.exitFullscreen !== "function") return;
    if (!this.doc.fullscreenElement) return;
    await this.doc.exitFullscreen();
  }
}
