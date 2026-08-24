import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ProseProfile } from "../../../application/use-cases/ProfileProse";

export const DESK_VIEW_TYPE = "creative-writer-desk";

export interface DeskSource {
  /** Profile of the active note, or null when no markdown note is active. */
  activeProfile(): { name: string; profile: ProseProfile } | null;
}

/**
 * The writing desk: everything about the work that is not the work itself.
 * Lives in a side leaf so Zen Mode hides it with the rest of the chrome.
 */
export class DeskView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly source: DeskSource) {
    super(leaf);
  }

  getViewType(): string {
    return DESK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Writing desk";
  }

  getIcon(): string {
    return "feather";
  }

  async onOpen(): Promise<void> {
    this.refresh();
  }

  refresh(): void {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "czm-desk" });
    const active = this.source.activeProfile();
    root.createEl("h4", { text: "Readability" });
    if (!active) {
      root.createEl("p", { text: "Open a note to see how it reads.", cls: "czm-desk-hint" });
      return;
    }
    root.createEl("p", { text: active.name, cls: "czm-desk-title" });
    renderProfile(root, active.profile);
  }
}

export function renderProfile(root: HTMLElement, p: ProseProfile): void {
  const counts = root.createDiv({ cls: "czm-desk-counts" });
  counts.createSpan({ text: `${p.wordCount.toLocaleString()} words` });
  counts.createSpan({ text: `${p.sentenceCount.toLocaleString()} sentences` });
  counts.createSpan({ text: `${p.paragraphCount.toLocaleString()} paragraphs` });

  if (!p.readingEase) {
    root.createEl("p", { text: "Not enough prose to measure yet.", cls: "czm-desk-hint" });
    return;
  }
  band(root, "Reading ease", p.readingEase.band.label, p.readingEase.band.hint, `Flesch ${Math.round(p.readingEase.score)} · grade ${Math.max(0, p.readingEase.grade).toFixed(1)}`);
  if (p.variety) band(root, "Sentence rhythm", p.variety.band.label, p.variety.band.hint, `${p.sentenceCount} sentences, variation ${Math.round(p.variety.cv * 100)}%`);
  else band(root, "Sentence rhythm", "—", "Needs at least three sentences.", "");
  band(root, "Dialogue", p.dialogue.band.label, p.dialogue.band.hint, `${Math.round(p.dialogue.ratio * 100)}% of words are spoken`);
}

function band(root: HTMLElement, name: string, label: string, hint: string, detail: string): void {
  const row = root.createDiv({ cls: "czm-desk-band" });
  const head = row.createDiv({ cls: "czm-desk-band-head" });
  head.createSpan({ text: name, cls: "czm-desk-band-name" });
  head.createSpan({ text: label, cls: "czm-desk-band-label" });
  row.createDiv({ text: hint, cls: "czm-desk-band-hint" });
  if (detail) row.createDiv({ text: detail, cls: "czm-desk-band-detail" });
}
