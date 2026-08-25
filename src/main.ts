import { MarkdownView, Notice, Plugin, editorInfoField, type WorkspaceLeaf } from "obsidian";
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
import { activeNoteExtension } from "./infrastructure/codemirror/activeNote";
import { FRONTMATTER_KEY, frontmatterFlag, isNoteActive } from "./domain/scope/NoteScope";
import { typewriterExtension } from "./infrastructure/codemirror/typewriterExtension";
import { currentLineExtension } from "./infrastructure/codemirror/currentLineExtension";
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
import { NoteProgressRepository } from "./infrastructure/obsidian/NoteProgressRepository";
import { vaultNoteIO } from "./infrastructure/obsidian/VaultNoteIO";
import { countWords } from "./domain/text/Dialogue";
import { toDay } from "./domain/progress/Dates";
import { splitScenes } from "./domain/text/Scenes";
import { inScope, parseProjectFrontmatter, projectStatus, projectStreak, recentAdded, type ProjectSpec, type ProjectStatus } from "./domain/progress/Project";
import { enabledStyleKinds } from "./domain/settings/Settings";
import { BuildStoryMap } from "./application/use-cases/BuildStoryMap";
import { AnalyzeSceneRelations } from "./application/use-cases/AnalyzeSceneRelations";
import { VaultProjectNotes } from "./infrastructure/obsidian/VaultProjectNotes";
import { StoryMapNoteRepository } from "./infrastructure/obsidian/StoryMapNoteRepository";
import { OllamaRelationAnalyser } from "./infrastructure/llm/OllamaRelationAnalyser";
import { STORY_MAP_VIEW_TYPE, StoryMapView } from "./infrastructure/obsidian/views/StoryMapView";
import { STORY_TIMELINE_VIEW_TYPE, StoryTimelineView } from "./infrastructure/obsidian/views/StoryTimelineView";
import { STORY_THREADS_VIEW_TYPE, StoryThreadsView } from "./infrastructure/obsidian/views/StoryThreadsView";
import { StoryThreadsNoteRepository } from "./infrastructure/obsidian/StoryThreadsNoteRepository";
import { BuildStoryThreads } from "./application/use-cases/BuildStoryThreads";
import { EditStoryThread } from "./application/use-cases/EditStoryThread";
import { AnalyzeSceneFacts } from "./application/use-cases/AnalyzeSceneFacts";
import { OllamaFactAnalyser } from "./infrastructure/llm/OllamaFactAnalyser";
import type { EntityKind, SceneRef } from "./domain/story/StoryGraph";
import { removeRelation, upsertRelation } from "./domain/story/Relations";
import { setLayout } from "./domain/story/StoryMapFile";
import { TFile, TFolder, normalizePath } from "obsidian";

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
    this.addCommand({
      id: "toggle-enabled",
      name: "Toggle everywhere",
      callback: () => {
        void this.updateSettings({ ...this.current, enabled: !this.current.enabled });
        new Notice(`creative-writer: ${this.current.enabled ? "on" : "off"}`);
      },
    });
    this.addCommand({
      id: "toggle-note",
      name: "Toggle for this note",
      editorCallback: (editor, view) => {
        const file = (view as MarkdownView).file;
        if (!file) return;
        const active = isNoteActive({ enabled: this.current.enabled, scope: this.current.scope, path: file.path, flag: frontmatterFlag(editor.getValue()) });
        void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm[FRONTMATTER_KEY] = !active; });
        new Notice(`creative-writer: ${!active ? "on" : "off"} for this note`);
      },
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
    // The log lives in a vault note so streaks sync; progress.json from earlier versions is imported once and left in place.
    const notes = vaultNoteIO(this.app.vault);
    const legacyProgress = new AdapterProgressRepository(this.app.vault.adapter, `${this.app.vault.configDir}/plugins/${this.manifest.id}/progress.json`);
    const isLogNote = (path: string) => path === this.current.goals.logNote;
    this.tracker = new TrackWriting(
      new NoteProgressRepository(notes, () => this.current.goals.logNote, legacyProgress),
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

    // Story map: rebuilt from the vault on demand; only model readings persist, in `Story map.md` inside the project.
    const projectNotes = new VaultProjectNotes(this.app);
    const storyRepo = new StoryMapNoteRepository(notes);
    const buildStoryMap = new BuildStoryMap(projectNotes, storyRepo, { candidateMinMentions: 3, tagger: new CompromiseTagger() });
    const storySource = {
      projects: () => buildStoryMap.projects(),
      activeProject: () => {
        const path = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
        return path ? buildStoryMap.projectFor(path) : null;
      },
      build: (project: ProjectSpec) => buildStoryMap.execute(project),
      openNote: (path: string) => void this.app.workspace.openLinkText(path, "", false),
      reveal: (ref: SceneRef) => void this.revealScene(ref.path, ref.line),
      settings: () => this.current.storyMap,
    };
    this.registerView(STORY_TIMELINE_VIEW_TYPE, (leaf: WorkspaceLeaf) => new StoryTimelineView(leaf, storySource));
    this.addCommand({ id: "open-story-timeline", name: "Open story timeline", callback: () => void this.openStoryTimeline(null) });
    this.registerView(STORY_MAP_VIEW_TYPE, (leaf: WorkspaceLeaf) => new StoryMapView(leaf, {
      ...storySource,
      activeNotePath: () => this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ?? null,
      promote: (project, name, kind) => this.createEntityNote(project.scope, name, kind),
      ignore: (project, name) => this.editList(project.notePath, "story-ignore", (list) => [...list.filter((n) => n !== name), name]),
      unignore: (project, name) => this.editList(project.notePath, "story-ignore", (list) => list.filter((n) => n !== name)),
      alias: (_project, entityPath, name) => this.editList(entityPath, "aliases", (list) => [...list.filter((n) => n !== name), name]),
      setRelation: (fromPath, toPath, label, previousLabel) => this.editRelation(fromPath, toPath, (text, link) => upsertRelation(text, link, label, previousLabel)),
      removeRelation: (fromPath, toPath, label) => this.editRelation(fromPath, toPath, (text, link) => removeRelation(text, link, label)),
      rename: (path, name) => this.renameNote(path, name),
      remove: async (path) => { const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) await this.app.fileManager.trashFile(f); },
      loadLayout: (project) => storyRepo.load(project).then((f) => f.layout),
      saveLayout: (project, layout) => storyRepo.update(project, (f) => setLayout(f, layout)).then(() => undefined),
      updateSettings: (next) => void this.updateSettings({ ...this.current, storyMap: next }),
      openTimeline: (project) => void this.openStoryTimeline(project),
      openThreads: (project) => void this.openStoryThreads(project),
      // Checked at click time, not load time, so switching the model on in settings takes effect without a reload.
      analyse: (project, notePath, graph, signal, onProgress) => {
        const cfg = this.current.llm;
        if (cfg.provider !== "ollama") throw new Error("Reading a note needs a local model — set Model to Local (Ollama) in Creative Writer settings.");
        const analyser = new OllamaRelationAnalyser(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
        return new AnalyzeSceneRelations(projectNotes, storyRepo, analyser).execute(project, notePath, graph, signal, onProgress);
      },
    }));
    this.addCommand({ id: "open-story-map", name: "Open story map", callback: () => void this.openStoryMap() });
    this.addRibbonIcon("git-fork", "Open story map", () => void this.openStoryMap());
    this.addRibbonIcon("gantt-chart", "Open story timeline", () => void this.openStoryTimeline(null));
    this.addCommand({
      id: "read-note-for-story-map",
      name: "Read this note with model (story map)",
      editorCallback: () => void this.openStoryMap().then(() => (this.app.workspace.getLeavesOfType(STORY_MAP_VIEW_TYPE)[0]?.view as StoryMapView | undefined)?.readActiveNote()),
    });
    // Story threads: the same graph laid out as one line, with facts read per scene and hand-drawn threads from `Story threads.md`.
    const threadsRepo = new StoryThreadsNoteRepository(notes);
    const buildThreads = new BuildStoryThreads(buildStoryMap, projectNotes, storyRepo, threadsRepo);
    const editThread = new EditStoryThread(threadsRepo);
    this.registerView(STORY_THREADS_VIEW_TYPE, (leaf: WorkspaceLeaf) => new StoryThreadsView(leaf, {
      projects: storySource.projects,
      activeProject: storySource.activeProject,
      activeNotePath: () => this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ?? null,
      build: (project) => buildThreads.execute(project),
      openNote: storySource.openNote,
      reveal: storySource.reveal,
      readFacts: async (project, notePath, signal, onProgress) => {
        const cfg = this.current.llm;
        if (cfg.provider !== "ollama") throw new Error("Reading for facts needs a local model — set Model to Local (Ollama) in Creative Writer settings.");
        const analyser = new OllamaFactAnalyser(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
        const graph = await buildStoryMap.execute(project);
        return new AnalyzeSceneFacts(projectNotes, storyRepo, analyser).execute(project, notePath, graph, signal, onProgress);
      },
      dismiss: (project, key) => buildThreads.dismiss(project, key),
      undismiss: (project, key) => buildThreads.undismiss(project, key),
      addToThread: (project, thread, link, note) => editThread.addRef(project, thread, link, note),
      removeFromThread: (project, thread, link) => editThread.removeRef(project, thread, link),
      threadsNotePath: (project) => StoryThreadsNoteRepository.pathFor(project),
      storyColors: () => this.current.storyMap.colors,
      settings: () => this.current.threads,
      updateSettings: (next) => void this.updateSettings({ ...this.current, threads: next }),
      openMap: () => void this.openStoryMap(),
    }));
    this.addCommand({ id: "open-story-threads", name: "Open story threads", callback: () => void this.openStoryThreads(null) });
    this.addRibbonIcon("spline", "Open story threads", () => void this.openStoryThreads(null));
    this.addCommand({
      id: "read-note-for-story-threads",
      name: "Read this note for facts (story threads)",
      editorCallback: () => void this.openStoryThreads(null).then(() => (this.app.workspace.getLeavesOfType(STORY_THREADS_VIEW_TYPE)[0]?.view as StoryThreadsView | undefined)?.readActiveNote()),
    });
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.refreshStoryMap()));
    this.registerEvent(this.app.vault.on("rename", () => this.refreshStoryMap()));
    this.registerEvent(this.app.vault.on("delete", () => this.refreshStoryMap()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshDesk()));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (file && md?.file === file && !isLogNote(file.path)) this.tracker.opened(file.path, countWords(md.editor.getValue()));
    }));
    this.registerEvent(this.app.workspace.on("editor-change", (editor, info) => {
      if (info.file && !isLogNote(info.file.path)) this.tracker.changed(info.file.path, countWords(editor.getValue()));
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.tracker.renamed(oldPath, file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.tracker.deleted(file.path)));
    this.app.workspace.onLayoutReady(() => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (md?.file && !isLogNote(md.file.path)) this.tracker.opened(md.file.path, countWords(md.editor.getValue()));
    });

    const readability = this.addStatusBarItem();
    readability.addClass("czm-status-readability");
    readability.setAttribute("aria-label", "Readability of the current paragraph. Click for the whole note.");
    readability.addEventListener("click", () => void this.openDesk());

    this.registerEditorExtension([
      this.settingsCompartment.of(settingsFacet.of(this.current)),
      activeNoteExtension((state) => state.field(editorInfoField, false)?.file?.path ?? null),
      readabilityStatusExtension(profile, (p) => {
        readability.setText(statusLabel(p));
        readability.title = p?.readingEase ? `${p.readingEase.band.hint}${p.variety ? `\n${p.variety.band.hint}` : ""}` : "";
      }),
      typewriterExtension(),
      currentLineExtension(),
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
      .filter((s): s is NonNullable<typeof s> => s !== null && s.targetWords > 0) // `story: true` projects have nothing to pace
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

  private async openStoryMap(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(STORY_MAP_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: STORY_MAP_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    await (leaf.view as StoryMapView).onOpen();
  }

  private async openStoryTimeline(project: ProjectSpec | null): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(STORY_TIMELINE_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("split", "vertical");
    if (!existing) await leaf.setViewState({ type: STORY_TIMELINE_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as StoryTimelineView;
    if (project) await view.show(project); else await view.onOpen();
  }

  private async openStoryThreads(project: ProjectSpec | null): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(STORY_THREADS_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: STORY_THREADS_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as StoryThreadsView;
    if (project) await view.show(project); else await view.onOpen();
  }

  private storyMapRefreshTimer: number | null = null;
  /** The metadata cache fires `resolved` on every edit; a rebuild every couple of seconds is plenty for a map. */
  private refreshStoryMap(): void {
    const ws = this.app.workspace;
    const open = ws.getLeavesOfType(STORY_MAP_VIEW_TYPE).length + ws.getLeavesOfType(STORY_TIMELINE_VIEW_TYPE).length + ws.getLeavesOfType(STORY_THREADS_VIEW_TYPE).length;
    if (open === 0) return;
    if (this.storyMapRefreshTimer !== null) window.clearTimeout(this.storyMapRefreshTimer);
    this.storyMapRefreshTimer = window.setTimeout(() => {
      this.storyMapRefreshTimer = null;
      for (const l of ws.getLeavesOfType(STORY_MAP_VIEW_TYPE)) void (l.view as StoryMapView).refresh();
      for (const l of ws.getLeavesOfType(STORY_TIMELINE_VIEW_TYPE)) void (l.view as StoryTimelineView).refresh();
      for (const l of ws.getLeavesOfType(STORY_THREADS_VIEW_TYPE)) void (l.view as StoryThreadsView).refresh();
    }, 2000);
  }

  /** Opens the note and puts the cursor on a scene's heading line. */
  private async revealScene(path: string, line: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
    const md = leaf.view instanceof MarkdownView ? leaf.view : null;
    if (!md) return;
    md.editor.setCursor({ line, ch: 0 });
    md.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    md.editor.focus();
  }

  /** Adds to or trims a list property in a note's front matter — `story-ignore` on the project note, `aliases` on an entity note. */
  private async editList(path: string, key: string, edit: (list: string[]) => string[]): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const raw = fm[key];
      const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : typeof raw === "string" ? [raw] : [];
      const next = edit(list);
      if (next.length) fm[key] = next; else delete fm[key];
    });
  }

  /** Rewrites the `## Relationships` section of one note; the link is generated the way the writer's vault writes links. */
  private async editRelation(fromPath: string, toPath: string, edit: (text: string, link: string) => string): Promise<void> {
    const from = this.app.vault.getAbstractFileByPath(fromPath), to = this.app.vault.getAbstractFileByPath(toPath);
    if (!(from instanceof TFile) || !(to instanceof TFile)) return;
    const link = this.app.fileManager.generateMarkdownLink(to, fromPath);
    await this.app.vault.process(from, (text) => edit(text, link));
  }

  /** Renames a note in place; Obsidian updates every link to it. Returns the new path. */
  private async renameNote(path: string, name: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return path;
    const safe = name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
    if (!safe || safe === file.basename) return path;
    const next = normalizePath(`${file.parent?.path && file.parent.path !== "/" ? `${file.parent.path}/` : ""}${safe}.md`);
    if (this.app.vault.getAbstractFileByPath(next)) throw new Error(`A note called "${safe}" already exists there.`);
    await this.app.fileManager.renameFile(file, next);
    return next;
  }

  /** A candidate becomes a real entity: a typed note in the project's Characters/, Places/, Items/… folder (created if missing). */
  private async createEntityNote(scope: string, name: string, kind: EntityKind): Promise<string> {
    const folder = scope.endsWith("/") || scope === "" ? scope : scope.slice(0, scope.lastIndexOf("/") + 1);
    const sub = { character: "Characters", location: "Places", item: "Items", faction: "Factions", event: "Events" }[kind as string] ?? "Characters";
    const dir = normalizePath(`${folder}${sub}`);
    if (!(this.app.vault.getAbstractFileByPath(dir) instanceof TFolder)) await this.app.vault.createFolder(dir);
    const safe = name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "Unnamed";
    const path = normalizePath(`${dir}/${safe}.md`);
    if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFile)) {
      await this.app.vault.create(path, `---\ntype: ${kind}\naliases: []\n---\n`);
    }
    return path;
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
