import { ZenMode } from "../../domain/zen/ZenMode";
import type { WorkspaceChrome } from "../ports/WorkspaceChrome";

/**
 * Orchestrates Zen Mode: flips the domain state and drives the chrome port.
 * Fullscreen is best-effort — browsers reject it without a user gesture and
 * Zen Mode must still work in that case.
 */
export class ToggleZenMode {
  private state = ZenMode.inactive();

  constructor(
    private readonly chrome: WorkspaceChrome,
    private readonly wantsFullscreen: () => boolean,
  ) {}

  get isActive(): boolean {
    return this.state.isActive;
  }

  async execute(): Promise<void> {
    this.state = this.state.toggle();
    if (this.state.isActive) await this.activate();
    else await this.restore();
  }

  /** Restores the workspace if active; safe to call repeatedly (e.g. on unload). */
  async deactivate(): Promise<void> {
    if (!this.state.isActive) return;
    this.state = this.state.toggle();
    await this.restore();
  }

  private async activate(): Promise<void> {
    this.chrome.hideChrome();
    if (this.wantsFullscreen()) await this.chrome.enterFullscreen().catch(() => undefined);
  }

  private async restore(): Promise<void> {
    this.chrome.showChrome();
    if (this.wantsFullscreen()) await this.chrome.exitFullscreen().catch(() => undefined);
  }
}
