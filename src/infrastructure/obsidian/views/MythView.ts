import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { MythReport } from "../../../domain/myth/MythReport";

export const MYTH_VIEW_TYPE = "creative-zen-myth";

/**
 * Sidebar report for the myth/archetype analysis. Everything the model
 * said goes in as text nodes — never innerHTML.
 */
export class MythView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return MYTH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Myth & archetype";
  }

  getIcon(): string {
    return "compass";
  }

  async onOpen(): Promise<void> {
    this.showIdle();
  }

  showIdle(): void {
    const root = this.reset();
    root.createEl("p", { text: "Select a scene (40+ words) and run “Analyse selection for myth and archetype”.", cls: "czm-myth-hint" });
  }

  showBusy(model: string): void {
    const root = this.reset();
    root.createEl("p", { text: `Analysing with ${model}…`, cls: "czm-myth-hint" });
  }

  showError(message: string): void {
    const root = this.reset();
    root.createEl("p", { text: message, cls: "czm-myth-error" });
  }

  showReport(report: MythReport, model: string): void {
    const root = this.reset();
    if (report.isEmpty) {
      root.createEl("p", { text: "No clear mythic pattern in this passage — which is fine; most scenes don't have one.", cls: "czm-myth-hint" });
    } else {
      if (report.summary) root.createEl("p", { text: report.summary, cls: "czm-myth-summary" });
      if (report.patterns.length) {
        root.createEl("h4", { text: "Patterns" });
        for (const p of report.patterns) {
          const item = root.createDiv({ cls: "czm-myth-item" });
          item.createDiv({ text: p.name, cls: "czm-myth-name" });
          item.createEl("blockquote", { text: p.evidence });
          if (p.note) item.createEl("p", { text: p.note });
        }
      }
      if (report.archetypes.length) {
        root.createEl("h4", { text: "Archetypes" });
        for (const a of report.archetypes) {
          const item = root.createDiv({ cls: "czm-myth-item" });
          item.createDiv({ text: a.character ? `${a.name} — ${a.character}` : a.name, cls: "czm-myth-name" });
          item.createEl("blockquote", { text: a.evidence });
        }
      }
      if (report.next) {
        root.createEl("h4", { text: "What the pattern asks next" });
        root.createEl("p", { text: report.next });
      }
    }
    root.createEl("p", { text: `via ${model}`, cls: "czm-myth-meta" });
  }

  private reset(): HTMLElement {
    this.contentEl.empty();
    return this.contentEl.createDiv({ cls: "czm-myth" });
  }
}
