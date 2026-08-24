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
import { TrackWriting } from "./application/use-cases/TrackWriting";
import { AdapterProgressRepository } from "./infrastructure/obsidian/AdapterProgressRepository";
import { countWords } from "./domain/text/Dialogue";
import { toDay } from "./domain/progress/Dates";
import { splitScenes } from "./domain/text/Scenes";
import { inScope, parseProjectFrontmatter, projectStatus, projectStreak, recentAdded, type ProjectStatus } from "./domain/progress/Project";
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
  private tracker!: TrackWriting;

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
    this.tracker = new TrackWriting(
      new AdapterProgressRepository(this.app.vault.adapter, `${this.app.vault.configDir}/plugins/${this.manifest.id}/progress.json`),
      { timers: { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) }, today: () => toDay(new Date()), debounceMs: 800, saveMs: 10_000, onChange: () => this.refreshDesk() },
    );
    await this.tracker.start();
    this.registerView(DESK_VIEW_TYPE, (leaf: WorkspaceLeaf) => new DeskView(leaf, {
      activeProfile: () => {
        const md = this.app.workspace.getActiveViewOfType(MarkdownView);
        return md?.file ? { name: md.file.basename, profile: profile.document(md.editor.getValue()) } : null;
      },
      log: () => this.tracker.current,
      today: () => toDay(new Date()),
      dailyGoal: () => this.current.goals.dailyWords,
      projects: () => this.projectStatuses(),
      scenes: () => {
        const md = this.app.workspace.getActiveViewOfType(MarkdownView);
        return md?.file ? splitScenes(md.editor.getValue()).map((scene) => ({ scene, profile: profile.paragraph(scene.prose) })) : [];
      },
      revealLine: (line) => {
        const md = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!md) return;
        md.editor.setCursor({ line, ch: 0 });
        md.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
        md.editor.focus();
      },
    }));
    this.addCommand({ id: "open-writing-desk", name: "Open writing desk", callback: () => void this.openDesk() });
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshDesk()));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (file && md?.file === file) this.tracker.opened(file.path, countWords(md.editor.getValue()));
    }));
    this.registerEvent(this.app.workspace.on("editor-change", (editor, info) => {
      if (info.file) this.tracker.changed(info.file.path, countWords(editor.getValue()));
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.tracker.renamed(oldPath, file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.tracker.deleted(file.path)));
    this.app.workspace.onLayoutReady(() => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (md?.file) this.tracker.opened(md.file.path, countWords(md.editor.getValue()));
    });

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

  /** Projects are declared in front matter; totals come from the vault, not the log, so untracked files count too. */
  private async projectStatuses(): Promise<ProjectStatus[]> {
    const files = this.app.vault.getMarkdownFiles();
    const specs = files
      .map((f) => parseProjectFrontmatter(this.app.metadataCache.getFileCache(f)?.frontmatter, f.path))
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (specs.length === 0) return [];
    const counts = new Map<string, number>();
    for (const f of files) {
      if (!specs.some((s) => inScope(s, f.path))) continue;
      counts.set(f.path, countWords(await this.app.vault.cachedRead(f)));
    }
    const today = toDay(new Date());
    return specs.map((spec) => {
      let total = 0;
      for (const [path, words] of counts) if (inScope(spec, path)) total += words;
      return projectStatus(spec, total, recentAdded(this.tracker.current, spec, today, 7), today, projectStreak(this.tracker.current, spec, today));
    });
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
    void this.tracker.flush();
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
