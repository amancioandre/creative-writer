import { MarkdownView, Notice, Plugin } from "obsidian";
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
import { RequestUrlHttpClient } from "./infrastructure/obsidian/RequestUrlHttpClient";
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
          new Notice("Creative Zen Mode: choose a model in settings first.");
          return;
        }
        const cm = (view as MarkdownView & { editor: { cm?: { dispatch: (spec: unknown) => void } } }).editor.cm;
        cm?.dispatch({ effects: analyseNow.of(null) });
      },
    });

    this.registerEditorExtension([
      this.settingsCompartment.of(settingsFacet.of(this.current)),
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
          new Notice(`Creative Zen Mode: ${e instanceof Error ? e.message : String(e)}`, 8000);
        },
      }),
    ]);

    this.addSettingTab(
      new CreativeZenSettingsTab(this.app, this, {
        current: () => this.current,
        update: (next) => this.updateSettings(next),
      }),
    );
  }

  async onunload(): Promise<void> {
    // Editor extensions are torn down by Obsidian; Zen Mode's body class is ours to remove.
    await this.zen.deactivate();
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
