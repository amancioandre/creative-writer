/**
 * The parts of the host application that Zen Mode hides and restores.
 * Implemented against Obsidian's DOM in infrastructure.
 */
export interface WorkspaceChrome {
  hideChrome(): void;
  showChrome(): void;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
}
