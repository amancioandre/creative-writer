import { MarkdownView, Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { Compartment } from "@codemirror/state";

import type { PluginSettings } from "./domain/settings/Settings";
import { ToggleZenMode } from "./application/use-cases/ToggleZenMode";
import { AnalyzeParagraphRhythm } from "./application/use-cases/AnalyzeParagraphRhythm";
import { AnalyzeParagraphStyle } from "./application/use-cases/AnalyzeParagraphStyle";
import { AnalyzeParagraphWithLlm } from "./application/use-cases/AnalyzeParagraphWithLlm";
import { IntlSentenceSegmenter } from "./infrastructure/segmentation/IntlSentenceSegmenter";
import { CompromiseTagger } from "./infrastructure/nlp/CompromiseTagger";
import { BrysbaertConcreteness } from "./infrastructure/nlp/BrysbaertConcreteness";
import { DomWorkspaceChrome } from "./infrastructure/obsidian/DomWorkspaceChrome";
import { PluginDataSettingsRepository } from "./infrastructure/obsidian/PluginDataSettingsRepository";
import { CreativeZenSettingsTab } from "./infrastructure/obsidian/SettingsTab";
import { settingsFacet } from "./infrastructure/codemirror/settingsFacet";
import { typewriterExtension } from "./infrastructure/codemirror/typewriterExtension";
import { focusFadeExtension } from "./infrastructure/codemirror/focusFadeExtension";
import { rhythmExtension } from "./infrastructure/codemirror/rhythmExtension";
import { styleExtension } from "./infrastructure/codemirror/styleExtension";
import { findingsTooltip } from "./infrastructure/codemirror/findingsTooltip";
import { asyncFindingsExtension, analyseNow } from "./infrastructure/codemirror/asyncFindingsExtension";
import { ConfiguredLlmAnalyser } from "./infrastructure/llm/ConfiguredLlmAnalyser";
import { OllamaMythAnalyser } from "./infrastructure/llm/OllamaMythAnalyser";
import { AnalyzeMyth } from "./application/use-cases/AnalyzeMyth";
import { MythView, MYTH_VIEW_TYPE } from "./infrastructure/obsidian/views/MythView";
import { RequestUrlHttpClient } from "./infrastructure/obsidian/RequestUrlHttpClient";
import { ProfileProse } from "./application/use-cases/ProfileProse";
import { readabilityStatusExtension, statusLabel } from "./infrastructure/codemirror/readabilityStatusExtension";
import { DeskView, DESK_VIEW_TYPE } from "./infrastructure/obsidian/views/DeskView";
import { enabledStyleKinds } from "./domain/settings/Settings";

/**
 * Composition root. The only file that knows about every layer: it builds
 * the adapters, injects them into the use cases, and registers the result
 * with Obsidian. No behaviour lives here — only wiring.
 */
export default class CreativeZenModePlugin extends Plugin {
  private current!: PluginSettings;
  private readonly settingsCompartment = new Compartment();
  private settingsRepo!: PluginDataSettingsRepository;
  private zen!: ToggleZenMode;
  private myth: AnalyzeMyth | null = null;

  async onload(): Promise<void> {
    this.settingsRepo = new PluginDataSettingsRepository(this);
    this.current = await this.settingsRepo.load();

    this.zen = new ToggleZenMode(new DomWorkspaceChrome(document), () => this.current.zenFullscreen);

    this.addCommand({
      id: "toggle-zen-mode",
      name: "Toggle Zen Mode",
      callback: () => void this.zen.execute(),
    });

    const llm = new ConfiguredLlmAnalyser(
      new RequestUrlHttpClient(),
      () => this.current.llm,
      (spend) => void this.updateSettings({ ...this.current, llm: { ...this.current.llm, spend } }),
    );
    const llmAnalyser = new AnalyzeParagraphWithLlm(llm, () => enabledStyleKinds(this.current));
    const status = this.addStatusBarItem();
    let lastErrorAt = 0;

    this.addCommand({
      id: "analyse-paragraph-with-model",
      name: "Analyse paragraph with model",
      editorCallback: (_editor, view) => {
        if (this.current.llm.provider === "off") {
          new Notice("creative-writer: choose a model in settings first.");
          return;
        }
        const cm = (view as MarkdownView & { editor: { cm?: { dispatch: (spec: unknown) => void } } }).editor.cm;
        cm?.dispatch({ effects: analyseNow.of(null) });
      },
    });

    this.registerView(MYTH_VIEW_TYPE, (leaf: WorkspaceLeaf) => new MythView(leaf));
    this.addCommand({
      id: "analyse-myth",
      name: "Analyse selection for myth and archetype",
      editorCallback: (editor) => void this.analyseMyth(editor.getSelection() || editor.getValue()),
    });

    const profile = new ProfileProse(new IntlSentenceSegmenter());
    this.registerView(DESK_VIEW_TYPE, (leaf: WorkspaceLeaf) => new DeskView(leaf, {
      activeProfile: () => {
        const md = this.app.workspace.getActiveViewOfType(MarkdownView);
        return md?.file ? { name: md.file.basename, profile: profile.document(md.editor.getValue()) } : null;
      },
    }));
    this.addCommand({ id: "open-writing-desk", name: "Open writing desk", callback: () => void this.openDesk() });
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshDesk()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshDesk()));

    const readability = this.addStatusBarItem();
    readability.addClass("czm-status-readability");
    readability.setAttribute("aria-label", "Readability of the current paragraph. Click for the whole note.");
    readability.addEventListener("click", () => void this.openDesk());

    this.registerEditorExtension([
      this.settingsCompartment.of(settingsFacet.of(this.current)),
      readabilityStatusExtension(profile, (p) => {
        readability.setText(statusLabel(p));
        readability.title = p?.readingEase ? `${p.readingEase.band.hint}${p.variety ? `\n${p.variety.band.hint}` : ""}` : "";
      }),
      typewriterExtension(),
      focusFadeExtension(),
      rhythmExtension(new AnalyzeParagraphRhythm(new IntlSentenceSegmenter())),
      styleExtension(AnalyzeParagraphStyle.withDefaultRules(new CompromiseTagger(), new BrysbaertConcreteness())),
      findingsTooltip(),
      asyncFindingsExtension(llmAnalyser, {
        onBusy: (busy) => {
          const cost = this.current.llm.provider === "claude" ? ` $${llm.ledger.sessionUsd.toFixed(3)}` : "";
          status.setText(busy ? `✦ ${llm.name}…` : cost.trim());
        },
        onError: (e) => {
          // One notice a minute is plenty; a dead Ollama would otherwise spam on every pause.
          if (Date.now() - lastErrorAt < 60_000) return;
          lastErrorAt = Date.now();
          new Notice(`creative-writer: ${e instanceof Error ? e.message : String(e)}`, 8000);
        },
      }),
    ]);

    this.addSettingTab(
      new CreativeZenSettingsTab(this.app, this, {
        current: () => this.current,
        update: (next) => this.updateSettings(next),
        configDir: () => this.app.vault.configDir,
      }),
    );
  }

  private async openDesk(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(DESK_VIEW_TYPE)[0] ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: DESK_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    (leaf.view as DeskView).refresh();
  }

  private deskRefreshTimer: number | null = null;
  /** Re-profiling a whole note on every keystroke is wasteful; once a second is plenty for a side panel. */
  private refreshDesk(): void {
    const leaf = this.app.workspace.getLeavesOfType(DESK_VIEW_TYPE)[0];
    if (!leaf) return;
    if (this.deskRefreshTimer !== null) window.clearTimeout(this.deskRefreshTimer);
    this.deskRefreshTimer = window.setTimeout(() => {
      this.deskRefreshTimer = null;
      (leaf.view as DeskView).refresh();
    }, 1000);
  }

  private async analyseMyth(text: string): Promise<void> {
    const cfg = this.current.llm;
    if (cfg.provider !== "ollama") {
      new Notice("creative-writer: myth analysis needs a local model — set Model to Local (Ollama) in settings.");
      return;
    }
    const leaf = this.app.workspace.getLeavesOfType(MYTH_VIEW_TYPE)[0] ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: MYTH_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as MythView;
    const analyser = new OllamaMythAnalyser(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
    const useCase = (this.myth ??= new AnalyzeMyth(analyser));
    view.showBusy(analyser.name);
    try {
      view.showReport(await useCase.execute(text, new AbortController().signal), analyser.name);
    } catch (e) {
      view.showError(e instanceof Error ? e.message : String(e));
    }
  }

  onunload(): void {
    // Editor extensions are torn down by Obsidian; Zen Mode's body class is ours to remove.
    void this.zen.deactivate();
  }

  private async updateSettings(next: PluginSettings): Promise<void> {
    this.current = next;
    await this.settingsRepo.save(next);
    // Push the new settings into every open editor; extensions react via the facet.
    this.app.workspace.iterateAllLeaves((leaf) => {
      const editor = (leaf.view as { editor?: { cm?: { dispatch: (spec: unknown) => void } } }).editor;
      editor?.cm?.dispatch({ effects: this.settingsCompartment.reconfigure(settingsFacet.of(next)) });
    });
  }
}
