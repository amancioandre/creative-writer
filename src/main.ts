import { Plugin } from "obsidian";
import { Compartment } from "@codemirror/state";

import type { PluginSettings } from "./domain/settings/Settings";
import { ToggleZenMode } from "./application/use-cases/ToggleZenMode";
import { AnalyzeParagraphRhythm } from "./application/use-cases/AnalyzeParagraphRhythm";
import { AnalyzeParagraphStyle } from "./application/use-cases/AnalyzeParagraphStyle";
import { IntlSentenceSegmenter } from "./infrastructure/segmentation/IntlSentenceSegmenter";
import { DomWorkspaceChrome } from "./infrastructure/obsidian/DomWorkspaceChrome";
import { PluginDataSettingsRepository } from "./infrastructure/obsidian/PluginDataSettingsRepository";
import { CreativeZenSettingsTab } from "./infrastructure/obsidian/SettingsTab";
import { settingsFacet } from "./infrastructure/codemirror/settingsFacet";
import { typewriterExtension } from "./infrastructure/codemirror/typewriterExtension";
import { focusFadeExtension } from "./infrastructure/codemirror/focusFadeExtension";
import { rhythmExtension } from "./infrastructure/codemirror/rhythmExtension";
import { styleExtension } from "./infrastructure/codemirror/styleExtension";
import { findingsTooltip } from "./infrastructure/codemirror/findingsTooltip";

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

    this.registerEditorExtension([
      this.settingsCompartment.of(settingsFacet.of(this.current)),
      typewriterExtension(),
      focusFadeExtension(),
      rhythmExtension(new AnalyzeParagraphRhythm(new IntlSentenceSegmenter())),
      styleExtension(AnalyzeParagraphStyle.withDefaultRules()),
      findingsTooltip(),
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
