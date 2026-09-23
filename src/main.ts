import { MarkdownRenderer, MarkdownView, Notice, Plugin, editorInfoField, type Constructor, type Editor, type FuzzyMatch, type View, type WorkspaceLeaf } from "obsidian";
import { Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

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
import { ReleaseNoteModal } from "./infrastructure/obsidian/ReleaseNoteModal";
import { releaseNoteDecision } from "./domain/release/ReleaseNote";
import { CreativeZenSettingsTab } from "./infrastructure/obsidian/SettingsTab";
import { settingsFacet } from "./infrastructure/codemirror/settingsFacet";
import { activeNoteExtension, projectScopesFacet } from "./infrastructure/codemirror/activeNote";
import { VaultWritingScope } from "./infrastructure/obsidian/VaultWritingScope";
import { filterLog, type WritingLog } from "./domain/progress/WritingLog";
import { FRONTMATTER_KEY, frontmatterFlag, isNoteActive } from "./domain/scope/NoteScope";
import { typewriterExtension } from "./infrastructure/codemirror/typewriterExtension";
import { currentLineExtension } from "./infrastructure/codemirror/currentLineExtension";
import { focusFadeExtension } from "./infrastructure/codemirror/focusFadeExtension";
import { rhythmExtension } from "./infrastructure/codemirror/rhythmExtension";
import { styleExtension } from "./infrastructure/codemirror/styleExtension";
import { commentTagExtension } from "./infrastructure/codemirror/commentTagExtension";
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
import type { EchoGroup } from "./domain/echoes/Echoes";

/** How long the desk keeps its echo list before reading the project again. */
const DESK_ECHOES_TTL_MS = 20_000;
import { TrackWriting } from "./application/use-cases/TrackWriting";
import { AdapterProgressRepository } from "./infrastructure/obsidian/AdapterProgressRepository";
import { NoteProgressRepository } from "./infrastructure/obsidian/NoteProgressRepository";
import { vaultNoteIO } from "./infrastructure/obsidian/VaultNoteIO";
import { countWords } from "./domain/text/Dialogue";
import { toDay } from "./domain/progress/Dates";
import { summarizeDay } from "./domain/progress/ProgressSummary";
import { splitScenes } from "./domain/text/Scenes";
import { inScope, parseProjectFrontmatter, projectConventions, projectStatus, projectStreak, recentAdded, type ProjectSpec, type ProjectStatus } from "./domain/progress/Project";
import { enabledStyleKinds } from "./domain/settings/Settings";
import { LENS_LABELS, nextLens, toggleLens, type Lens } from "./domain/lens/Lens";
import { EMPTY_WORD_LISTS, listsFor, sourceOf, wordListsFacet, wordsExtension, type WordLists } from "./infrastructure/codemirror/wordsExtension";
import { addTerm, removeTerm } from "./domain/words/WordList";
import { lensExtension } from "./infrastructure/codemirror/lensExtension";
import { conventionsFacet, dialogueExtension, rostersFacet, speakerAtCursor, type ConventionsByScope, type RostersByScope } from "./infrastructure/codemirror/dialogueExtension";
import type { Speaker } from "./domain/dialogue/Speakers";
import { buildRoster } from "./domain/dialogue/Speakers";
import { resolveConventions } from "./domain/dialogue/DialogueSpans";
import type { EntityNote } from "./domain/story/EntityIndex";
import { loadWordLists } from "./infrastructure/obsidian/VaultWordLists";
import { lensMenu } from "./infrastructure/obsidian/lensMenu";
import { tagSpeaker } from "./infrastructure/codemirror/speakerBox";
import { BuildStoryMap } from "./application/use-cases/BuildStoryMap";
import { AnalyzeSceneRelations } from "./application/use-cases/AnalyzeSceneRelations";
import { VaultProjectNotes } from "./infrastructure/obsidian/VaultProjectNotes";
import { StoryMapNoteRepository } from "./infrastructure/obsidian/StoryMapNoteRepository";
import { OllamaRelationAnalyser } from "./infrastructure/llm/OllamaRelationAnalyser";
import { STORY_MAP_VIEW_TYPE, StoryMapView } from "./infrastructure/obsidian/views/StoryMapView";
import { BuildWriterBoard } from "./application/use-cases/BuildWriterBoard";
import { VaultWriterNotes } from "./infrastructure/obsidian/VaultWriterNotes";
import { WriterFileRepository } from "./infrastructure/obsidian/WriterFileRepository";
import { VaultWriterTags } from "./infrastructure/obsidian/VaultWriterTags";
import { VaultWriterFiles } from "./infrastructure/obsidian/VaultWriterFiles";
import { BuildWriterStories } from "./application/use-cases/BuildWriterStories";
import { PromoteIdea } from "./application/use-cases/PromoteIdea";
import { WRITER_VIEW_TYPE, WriterView, type WriterSource } from "./infrastructure/obsidian/views/WriterView";
import { WRITER_EXTENSION, renameCard } from "./domain/writer/WriterFile";
import { writerTag } from "./domain/writer/Tags";
import { PLOT_GRID_VIEW_TYPE, PlotGridView } from "./infrastructure/obsidian/views/PlotGridView";
import { BuildPlotGrid } from "./application/use-cases/BuildPlotGrid";
import { SnapshotPlotGrid } from "./application/use-cases/SnapshotPlotGrid";
import { ReadColumn } from "./application/use-cases/ReadColumn";
import { ProposeColumns } from "./application/use-cases/ProposeColumns";
import { OllamaColumnAnalyser } from "./infrastructure/llm/OllamaColumnAnalyser";
import { ClaudeColumnAnalyser } from "./infrastructure/llm/ClaudeColumnAnalyser";
import { dismissColumnReadings, setGridReadingState } from "./domain/story/StoryMapFile";
import { CostLedger, costOf, PRICES } from "./domain/style/llm/CostLedger";
import type { ColumnAnalyser } from "./application/ports/ColumnAnalyser";
import { STORY_THREADS_VIEW_TYPE, StoryThreadsView } from "./infrastructure/obsidian/views/StoryThreadsView";
import { StoryThreadsNoteRepository } from "./infrastructure/obsidian/StoryThreadsNoteRepository";
import { OutlineNoteRepository } from "./infrastructure/obsidian/OutlineNoteRepository";
import { ScaffoldManuscript } from "./application/use-cases/ScaffoldManuscript";
import { ApplyTemplate } from "./application/use-cases/ApplyTemplate";
import { parseSnapshot, snapshotName } from "./domain/plot/Snapshot";
import { VaultTemplates } from "./infrastructure/obsidian/VaultTemplates";
import { relinkThreadItems } from "./domain/threads/StoryThreadsNote";
import { BuildStoryThreads } from "./application/use-cases/BuildStoryThreads";
import { EditStoryThread } from "./application/use-cases/EditStoryThread";
import { AnalyzeSceneFacts } from "./application/use-cases/AnalyzeSceneFacts";
import { BuildManuscript } from "./application/use-cases/BuildManuscript";
import { ExportManuscript } from "./application/use-cases/ExportManuscript";
import { MANUSCRIPT_VIEW_TYPE, ManuscriptView } from "./infrastructure/obsidian/views/ManuscriptView";
import type { PanelId } from "./infrastructure/obsidian/views/PanelShell";
import { castFromGraph, conflictMarks, echoMarks, threadMarks, type SectionFacts, gaugeMarks } from "./domain/manuscript/StoryFacts";
import { toggleResolved } from "./domain/manuscript/Comments";
import { COMMANDS, type CommandId } from "./infrastructure/obsidian/commands";
import { OllamaFactAnalyser } from "./infrastructure/llm/OllamaFactAnalyser";
import { OllamaIntentAnalyser } from "./infrastructure/llm/OllamaIntentAnalyser";
import { OllamaEmbedder } from "./infrastructure/llm/OllamaEmbedder";
import { AnalyzeContradictionIntent } from "./application/use-cases/AnalyzeContradictionIntent";
import { AnalyzeProjectEchoes } from "./application/use-cases/AnalyzeProjectEchoes";
import type { EntityKind, SceneRef } from "./domain/story/StoryGraph";
import type { Archetype } from "./domain/myth/MythReport";
import { removeRelation, upsertRelation } from "./domain/story/Relations";
import { setLayout } from "./domain/story/StoryMapFile";
import { FuzzySuggestModal, TFile, TFolder, normalizePath, type App, type CachedMetadata } from "obsidian";
import { tagsOf } from "./infrastructure/obsidian/VaultWriterNotes";
import { groupsFromTags } from "./domain/writer/Tags";

/** A picker over the writer board's cards, for the REF command. */
class CardPicker extends FuzzySuggestModal<{ path: string; title: string; groups: string }> {
  private chosen: string | null = null;
  private settled = false;
  constructor(app: App, private readonly cards: { path: string; title: string; groups: string }[], private readonly resolve: (path: string | null) => void) {
    super(app);
    this.setPlaceholder("Reference a card from the writer board…");
  }
  getItems() { return this.cards; }
  getItemText(item: { title: string; groups: string }): string { return `${item.title}  ·  ${item.groups}`; }
  onChooseItem(item: { path: string }): void { this.chosen = item.path; this.settle(); }
  onClose(): void { super.onClose(); window.setTimeout(() => this.settle(), 0); }
  private settle(): void { if (this.settled) return; this.settled = true; this.resolve(this.chosen); }
}

/**
 * A picker over every Markdown note in the vault; resolves with the chosen
 * path, or null when dismissed. Obsidian closes the modal *before* it
 * reports the choice, so the answer is settled a tick after closing.
 */
class NotePicker extends FuzzySuggestModal<TFile> {
  private chosen: string | null = null;
  private settled = false;
  constructor(app: App, private readonly resolve: (path: string | null) => void) {
    super(app);
    this.setPlaceholder("Put a note on the writer board…");
  }
  getItems(): TFile[] { return this.app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime); }
  getItemText(item: TFile): string { return item.path.replace(/\.md$/, ""); }
  onChooseItem(item: TFile): void { this.chosen = item.path; this.settle(); }
  onClose(): void { super.onClose(); window.setTimeout(() => this.settle(), 0); }
  private settle(): void { if (this.settled) return; this.settled = true; this.resolve(this.chosen); }
}

/**
 * Composition root. The only file that knows about every layer: it builds
 * the adapters, injects them into the use cases, and registers the result
 * with Obsidian. No behaviour lives here — only wiring.
 */
export default class CreativeZenModePlugin extends Plugin {
  private current!: PluginSettings;
  private readonly settingsCompartment = new Compartment();
  private readonly projectsCompartment = new Compartment();
  private readonly wordsCompartment = new Compartment();
  private readonly conventionsCompartment = new Compartment();
  private readonly rostersCompartment = new Compartment();
  /** The notes the Words lens read last, so a change to one of them reloads the lists. */
  private wordListPaths: readonly string[] = [];
  private wordLists: WordLists = EMPTY_WORD_LISTS;
  private wordListsKey = "";
  private lensStatus: HTMLElement | null = null;
  /** The one scope rule: what the editor runs in is what the log, the projects and the story map count. */
  private scope!: VaultWritingScope;
  private projectScopesKey = "";
  private settingsRepo!: PluginDataSettingsRepository;
  private zen!: ToggleZenMode;
  private myth: AnalyzeMyth | null = null;
  private tracker!: TrackWriting;

  async onload(): Promise<void> {
    this.settingsRepo = new PluginDataSettingsRepository(this);
    this.current = await this.settingsRepo.load();

    this.zen = new ToggleZenMode(new DomWorkspaceChrome(document, {
      wordsToday: () => summarizeDay(filterLog(this.tracker.current, (path) => this.scope.counts(path)), toDay(new Date()), this.current.goals.dailyWords).added,
      leave: () => void this.zen.deactivate(),
    }), () => this.current.zenFullscreen);

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
        const active = isNoteActive({ enabled: this.current.enabled, scope: this.current.scope, path: file.path, flag: frontmatterFlag(editor.getValue()), projectScopes: this.projectScopes() });
        void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm[FRONTMATTER_KEY] = !active; });
        new Notice(`creative-writer: ${!active ? "on" : "off"} for this note`);
      },
    });

    // Lenses: one reading pass at a time, everywhere. Each is a command that toggles it; the status-bar item cycles them.
    this.addCommand({ id: "lens-style", name: COMMANDS["lens-style"], callback: () => void this.setLens(toggleLens(this.current.lens, "style")) });
    this.addCommand({ id: "lens-dialogue", name: COMMANDS["lens-dialogue"], callback: () => void this.setLens(toggleLens(this.current.lens, "dialogue")) });
    this.addCommand({ id: "lens-words", name: COMMANDS["lens-words"], callback: () => void this.setLens(toggleLens(this.current.lens, "words")) });
    this.addCommand({ id: "lens-accents", name: COMMANDS["lens-accents"], callback: () => void this.setLens(toggleLens(this.current.lens, "accents")) });
    // The lenses' hands: the word under the cursor into a list, or into a character's accent.
    this.addCommand({
      id: "words-add",
      name: COMMANDS["words-add"],
      editorCallback: (editor, view) => {
        const word = wordAtCursor(editor);
        if (!word) { new Notice("creative-writer: put the cursor on a word, or select a phrase."); return; }
        const path = (view as MarkdownView).file?.path ?? null;
        const note = sourceOf(this.wordLists, path) ?? this.current.words.note;
        const categories = listsFor(this.wordLists, path).map((c) => c.name);
        new CategoryModal(this.app, categories, word, (category) => void this.addWord(note, category, word)).open();
      },
    });
    for (const [id, list] of [["accents-add", "accent"], ["accents-never", "accent-never"]] as const) {
      this.addCommand({
        id,
        name: COMMANDS[id],
        editorCallback: (editor, view) => {
          const word = wordAtCursor(editor);
          if (!word) { new Notice("creative-writer: put the cursor on a word, or select a phrase."); return; }
          const cm = (view as MarkdownView & { editor: { cm?: EditorView } }).editor.cm;
          const speaker = cm ? cm.state.facet(speakerAtCursor).map((f) => f(cm)).find((s) => s !== null) ?? null : null;
          if (!speaker) { new Notice("creative-writer: this line has no certain speaker. Switch to the dialogue or accents lens and pin one first."); return; }
          void this.editAccent(speaker, list, word, true);
        },
      });
    }
    this.addCommand({
      id: "dialogue-tag-speaker",
      name: COMMANDS["dialogue-tag-speaker"],
      editorCallback: (_editor, view) => {
        if (this.current.lens !== "dialogue" && this.current.lens !== "accents") { new Notice("creative-writer: switch to the dialogue lens to tag a speaker."); return; }
        const cm = (view as MarkdownView & { editor: { cm?: { dispatch: (spec: unknown) => void } } }).editor.cm;
        cm?.dispatch({ effects: tagSpeaker.of(null) });
      },
    });
    this.addCommand({ id: "lens-next", name: COMMANDS["lens-next"], callback: () => void this.setLens(nextLens(this.current.lens)) });
    this.addCommand({ id: "lens-off", name: COMMANDS["lens-off"], callback: () => void this.setLens("none") });
    const lensStatus = this.addStatusBarItem();
    lensStatus.addClass("czm-status-lens");
    lensStatus.setAttribute("role", "button");
    lensStatus.tabIndex = 0;
    lensStatus.setAttribute("aria-haspopup", "menu");
    const menuPort = { current: () => this.current, update: (next: PluginSettings) => void this.setLens(next.lens, next) };
    lensStatus.addEventListener("click", (ev) => lensMenu(menuPort).showAtMouseEvent(ev));
    lensStatus.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      const r = lensStatus.getBoundingClientRect();
      lensMenu(menuPort).showAtPosition({ x: r.left, y: r.top });
    });
    this.lensStatus = lensStatus;
    this.renderLensStatus();

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

    this.registerView(MYTH_VIEW_TYPE, (leaf: WorkspaceLeaf) => new MythView(leaf, { toWriter: (a) => void this.archetypeToWriter(a) }));
    this.addCommand({
      id: "analyse-myth",
      name: "Analyse selection for myth and archetype",
      editorCallback: (editor) => void this.analyseMyth(editor.getSelection() || editor.getValue()),
    });

    const profile = new ProfileProse(new IntlSentenceSegmenter());
    // The log lives in a vault note so streaks sync; progress.json from earlier versions is imported once and left in place.
    const notes = vaultNoteIO(this.app.vault);
    const legacyProgress = new AdapterProgressRepository(this.app.vault.adapter, `${this.app.vault.configDir}/plugins/${this.manifest.id}/progress.json`);
    this.scope = new VaultWritingScope(this.app, () => this.current, () => this.projectScopes());
    // The log records every note it is shown; the desk reads it through the scope, so a change of scope re-derives history.
    const countedLog = () => filterLog(this.tracker.current, (path) => this.scope.counts(path));
    this.tracker = new TrackWriting(
      new NoteProgressRepository(notes, () => this.current.goals.logNote, legacyProgress),
      { timers: { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) }, today: () => toDay(new Date()), debounceMs: 800, saveMs: 10_000, onChange: () => this.refreshDesk() },
    );
    let deskEchoes: { scope: string; at: number; found: { project: string; groups: readonly EchoGroup[] } } | null = null;
    this.registerView(DESK_VIEW_TYPE, (leaf: WorkspaceLeaf) => new DeskView(leaf, {
      activeProfile: () => {
        // The desk keeps the note the writer was in, even while the desk itself has the focus.
        const md = this.app.workspace.getActiveViewOfType(MarkdownView) ?? this.lastMarkdownView();
        return md?.file ? { name: md.file.basename, profile: profile.document(md.editor.getValue()) } : null;
      },
      log: countedLog,
      today: () => toDay(new Date()),
      dailyGoal: () => this.current.goals.dailyWords,
      projects: () => this.projectStatuses(countedLog()),
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
      // The desk refreshes on every pause in typing; the echoes are a view over the threads model, which reads the whole
      // project, so the list is kept for a short while rather than rebuilt each time.
      echoes: async () => {
        const path = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
        const project = path ? buildStoryMap.projectFor(path) : null;
        if (!project) return null;
        const cached = deskEchoes;
        if (cached && cached.scope === project.scope && Date.now() - cached.at < DESK_ECHOES_TTL_MS) return cached.found;
        const model = await buildThreads.execute(project);
        const found = { project: project.name, groups: model.echoes.groups };
        deskEchoes = { scope: project.scope, at: Date.now(), found };
        return found;
      },
      revealScene: (ref) => void this.revealScene(ref.path, ref.line),
      jumpTo: (to) => this.jumpTo(to, null),
      rhythmTiers: () => this.current.rhythmTiers,
    }));
    this.addCommand({ id: "open-writing-desk", name: "Open writing desk", callback: () => void this.openDesk() });

    // Story map: rebuilt from the vault on demand; only model readings persist, in `Story map.md` inside the project.
    // Notes open in an editor are read from the editor, unsaved edits included, so the manuscript follows the typing.
    const projectNotes = new VaultProjectNotes(this.app, (path) => this.scope.counts(path), (path) => this.editorText(path));
    const storyRepo = new StoryMapNoteRepository(notes);
    const buildStoryMap = new BuildStoryMap(projectNotes, storyRepo, { candidateMinMentions: 3, tagger: new CompromiseTagger() });
    const storySource = {
      jumpTo: (to: PanelId, project: ProjectSpec | null) => this.jumpTo(to, project),
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
      remove: async (path) => {
        const f = this.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) return "";
        const text = await this.app.vault.read(f);
        await this.app.fileManager.trashFile(f);
        return text;
      },
      restore: async (path, text) => {
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) { await this.app.vault.modify(existing, text); return; }
        const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        if (dir && !this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
        await this.app.vault.create(path, text);
      },
      loadLayout: (project) => storyRepo.load(project).then((f) => f.layout),
      saveLayout: (project, layout) => storyRepo.update(project, (f) => setLayout(f, layout)).then(() => undefined),
      updateSettings: (next) => void this.updateSettings({ ...this.current, storyMap: next }),
      // Checked at click time, not load time, so switching the model on in settings takes effect without a reload.
      analyse: (project, notePath, graph, signal, onProgress) => {
        const cfg = this.current.llm;
        if (cfg.provider !== "ollama") throw new Error("Reading a note needs a local model — set Model to Local (Ollama) in Creative Writer settings.");
        const analyser = new OllamaRelationAnalyser(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
        return new AnalyzeSceneRelations(projectNotes, storyRepo, analyser).execute(project, notePath, graph, signal, onProgress);
      },
    }));
    this.addCommand({ id: "open-story-map", name: COMMANDS["open-story-map"], callback: () => void this.openStoryMap() });
    // The map's head, as commands too, so they can be rebound in Settings → Hotkeys. Live only while the map is the active view.
    this.viewCommands(StoryMapView, [["story-map-add-node", "add"], ["story-map-fit", "fit"], ["story-map-show-all", "show-all"], ["story-map-shake", "shake"], ["story-map-read-project", "read-project"], ["story-map-reset-filters", "reset-filters"]]);
    this.addRibbonIcon("git-fork", "Open story map", () => void this.openStoryMap());

    // Writer: the board is rebuilt from tagged notes; only layout, colours and named edges persist, in the vault's one `.writer` file.
    const writerRepo = new WriterFileRepository({ ...notes, paths: () => this.app.vault.getFiles().map((f) => f.path) }, () => this.current.writer.storiesFolder);
    const buildWriterBoard = new BuildWriterBoard(new VaultWriterNotes(this.app, (path) => this.editorText(path)), writerRepo);
    const copySchema = async () => {
      await navigator.clipboard.writeText(await buildWriterBoard.schema());
      new Notice("creative-writer: the writer protocol is on the clipboard.");
    };
    this.addCommand({ id: "copy-writer-schema", name: COMMANDS["copy-writer-schema"], callback: () => void copySchema() });
    const asFile = (path: string): TFile | null => { const f = this.app.vault.getAbstractFileByPath(path); return f instanceof TFile ? f : null; };
    const frontMatterOf = async (path: string, change: (fm: Record<string, unknown>) => void) => { const f = asFile(path); if (f) await this.app.fileManager.processFrontMatter(f, change); };
    const writerTags = new VaultWriterTags({
      processFrontMatter: frontMatterOf,
      process: async (path, change) => { const f = asFile(path); if (f) await this.app.vault.process(f, change); },
    });
    /** The metadata cache indexes a note a moment after it is written; the board reads the cache, so wait for it. */
    const indexed = async (path: string, ok: (cache: CachedMetadata | null) => boolean): Promise<void> => {
      for (let i = 0; i < 30; i++) {
        const f = asFile(path);
        if (f && ok(this.app.metadataCache.getFileCache(f))) return;
        await new Promise((r) => window.setTimeout(r, 100));
      }
    };
    const writerFiles = new VaultWriterFiles(this.app, notes, frontMatterOf);
    const buildWriterStories = new BuildWriterStories(projectNotes, writerFiles, () => this.tracker.current, () => this.current.writer.storiesFolder, profile);
    const promoteIdea = new PromoteIdea(writerFiles);
    const writerSource: WriterSource = {
      build: async () => {
        const file = await writerRepo.load();
        const board = await buildWriterBoard.boardFor(file);
        return { board, file, stories: await buildWriterStories.execute(board) };
      },
      setStage: async (spec, stage) => {
        await writerFiles.processFrontMatter(spec.notePath, (fm) => { if (stage) fm["writing-stage"] = stage; else delete fm["writing-stage"]; });
        await indexed(spec.notePath, (c) => (stage ? c?.frontmatter?.["writing-stage"] === stage : c?.frontmatter?.["writing-stage"] === undefined));
      },
      promote: async (idea, name, folder) => {
        const path = await promoteIdea.execute({ idea, name, folder });
        await indexed(path, (c) => !!c?.frontmatter);
        if (idea) await indexed(idea.path, (c) => c?.frontmatter?.["writer-story"] !== undefined);
        return path;
      },
      declare: async (folder) => { const path = await promoteIdea.declare(folder); await indexed(path, (c) => c?.frontmatter?.["story"] !== undefined); },
      jumpTo: (to) => this.jumpTo(to, null),
      openStory: (view, spec) => {
        if (view === "map") void this.openStoryMap().then(() => (this.app.workspace.getLeavesOfType(STORY_MAP_VIEW_TYPE)[0]?.view as StoryMapView | undefined)?.show(spec));
        else if (view === "timeline") void this.openPlotGrid(spec);
        else if (view === "threads") void this.openStoryThreads(spec);
        else if (view === "manuscript") void this.openManuscript(spec);
        else void this.openDesk();
      },
      storiesFolder: () => this.current.writer.storiesFolder,
      setVoice: async (spec, voicePath) => {
        const link = voicePath ? `[[${voicePath.slice(voicePath.lastIndexOf("/") + 1).replace(/\.md$/i, "")}]]` : null;
        await writerFiles.processFrontMatter(spec.notePath, (fm) => { if (link) fm["writing-voice"] = link; else delete fm["writing-voice"]; });
        await indexed(spec.notePath, (c) => (link ? c?.frontmatter?.["writing-voice"] === link : c?.frontmatter?.["writing-voice"] === undefined));
      },
      setReading: async (path, status) => {
        await writerFiles.processFrontMatter(path, (fm) => { if (status) fm["reading"] = status; else delete fm["reading"]; });
        await indexed(path, (c) => (status ? c?.frontmatter?.["reading"] === status : c?.frontmatter?.["reading"] === undefined));
      },
      update: (change) => writerRepo.update(change),
      filePath: () => writerRepo.path(),
      openNote: (path) => void this.app.workspace.openLinkText(path, "", false),
      retag: async (path, from, to) => {
        const prefix = (await writerRepo.load()).prefix;
        await writerTags.retag(path, prefix, from, to);
        await indexed(path, (c) => { const g = groupsFromTags(tagsOf(c), prefix); return (!to || g.includes(to)) && (!from || !g.includes(from)); });
      },
      pickNote: () => new Promise((resolve) => new NotePicker(this.app, resolve).open()),
      createNote: async (title, group) => {
        const prefix = (await writerRepo.load()).prefix;
        // A card is a note like any other: it goes where Obsidian puts new notes (Settings → Files and links → Default location for new notes).
        const parent = this.app.fileManager.getNewFileParent("");
        const folder = parent.isRoot() ? "" : parent.path;
        const base = title.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
        const at = (name: string) => normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
        let path = at(base);
        for (let i = 2; await notes.exists(path); i++) path = at(`${base} ${i}`);
        await notes.write(path, `---\ntags: [${writerTag(prefix, group)}]\n---\n`);
        await indexed(path, (c) => !!c?.frontmatter);
        return path;
      },
      copySchema,
      settings: () => this.current.writer,
      updateSettings: (next) => void this.updateSettings({ ...this.current, writer: next }),
    };
    this.addCommand({
      id: "reference-writer-card",
      name: "Reference a writer card",
      // `%% REF: [[Card]] %%` at the cursor: a link the manuscript page and any export hide, and the board counts as a use.
      editorCallback: (editor) => {
        void writerRepo.load().then(async (file) => {
          const board = await buildWriterBoard.boardFor(file);
          if (!board.cards.length) { new Notice("creative-writer: nothing on the writer board yet."); return; }
          new CardPicker(this.app, board.cards.map((c) => ({ path: c.path, title: c.title, groups: c.groups.join(", ") })), (path) => {
            if (!path) return;
            const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
            const from = editor.posToOffset(editor.getCursor("from"));
            const text = `%% REF: [[${name}]] %%`;
            editor.replaceSelection(text);
            editor.setCursor(editor.offsetToPos(from + text.length));
          }).open();
        });
      },
    });
    this.writer = { repo: writerRepo, board: buildWriterBoard, source: writerSource };
    this.registerView(WRITER_VIEW_TYPE, (leaf: WorkspaceLeaf) => new WriterView(leaf, writerSource));
    this.registerExtensions([WRITER_EXTENSION], WRITER_VIEW_TYPE);
    this.addCommand({ id: "open-writer", name: COMMANDS["open-writer"], callback: () => void this.openWriter() });
    this.addCommand({ id: "show-release-note", name: COMMANDS["show-release-note"], callback: () => this.openReleaseNote("update") });
    // The board's keys and its side column, as commands too, so they can be rebound in Settings → Hotkeys. Live only while the board is the active view.
    this.viewCommands(WriterView, [
      ["writer-next-lane", "next-lane"], ["writer-previous-lane", "previous-lane"], ["writer-next-group", "next-group"], ["writer-previous-group", "previous-group"],
      ["writer-new-note", "new-note"], ["writer-add-note", "add-note"], ["writer-new-story", "new-story"], ["writer-fit", "fit"], ["writer-shortcuts", "help"],
    ]);
    this.addRibbonIcon("layout-dashboard", "Open writer", () => void this.openWriter());
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => { if (file instanceof TFile && file.extension === "md") void writerRepo.update((f) => renameCard(f, oldPath, file.path)).then(() => this.refreshWriter()); }));
    this.addRibbonIcon("table", "Open plot grid", () => void this.openPlotGrid(null));
    this.addCommand({
      id: "read-note-for-story-map",
      name: "Read this note with model (story map)",
      editorCallback: () => void this.openStoryMap().then(() => (this.app.workspace.getLeavesOfType(STORY_MAP_VIEW_TYPE)[0]?.view as StoryMapView | undefined)?.readActiveNote()),
    });
    // Story threads: the same graph laid out as one line, with facts read per scene and hand-drawn threads from `Story threads.md`.
    const threadsRepo = new StoryThreadsNoteRepository(notes);
    const buildThreads = new BuildStoryThreads(buildStoryMap, projectNotes, storyRepo, threadsRepo, undefined, { segmenter: new IntlSentenceSegmenter(), sensitivity: () => this.current.threads.echoSensitivity });
    // The plot grid: the timeline grown up. Same view type, so leaves open across the update come back as the grid.
    const outlineRepo = new OutlineNoteRepository(notes);
    const scaffold = new ScaffoldManuscript(outlineRepo, threadsRepo, notes, () => toDay(new Date()));
    const templates = new ApplyTemplate(new VaultTemplates(this.app, notes, () => this.current.plotGrid.templatesFolder), threadsRepo, outlineRepo, { set: (project, key, value) => this.setTextKey(project.notePath, key, value) });
    const buildPlotGrid = new BuildPlotGrid(buildThreads, outlineRepo);
    const snapshotPlotGrid = new SnapshotPlotGrid(buildPlotGrid, notes);
    const editThread = new EditStoryThread(threadsRepo);
    const segmenter = new IntlSentenceSegmenter();
    this.registerView(PLOT_GRID_VIEW_TYPE, (leaf: WorkspaceLeaf) => new PlotGridView(leaf, {
      ...storySource,
      build: (project) => buildPlotGrid.execute(project),
      threadsNotePath: (project) => StoryThreadsNoteRepository.pathFor(project),
      outlinePath: (project) => outlineRepo.pathFor(project),
      updateOutline: (project, change) => outlineRepo.update(project, change),
      templates: () => templates.list(),
      planTemplate: (project, template, choices, cast) => templates.plan(project, template, choices, cast),
      applyTemplate: (project, plan) => templates.execute(project, plan),
      saveTemplate: (project, name, parts) => templates.save(project, name, parts),
      templatesFolder: () => this.current.plotGrid.templatesFolder,
      snapshots: async (project) => {
        const folder = project.scope.endsWith("/") || project.scope === "" ? project.scope : project.scope.slice(0, project.scope.lastIndexOf("/") + 1);
        return this.app.vault.getMarkdownFiles()
          .filter((f) => f.path.startsWith(folder) && !f.path.slice(folder.length).includes("/"))
          .map((f) => ({ path: f.path, named: snapshotName(f.path) }))
          .filter((x): x is { path: string; named: { day: string; label: string } } => x.named !== null)
          .map((x) => ({ path: x.path, day: x.named.day, label: x.named.label }))
          .sort((a, b) => b.day.localeCompare(a.day) || a.label.localeCompare(b.label));
      },
      readSnapshot: async (path) => parseSnapshot(await notes.read(path)),
      scaffoldPreview: (project, shape) => scaffold.preview(project, shape),
      scaffold: (project, shape) => scaffold.execute(project, shape),
      relinkStops: async (project, from, to) => { let changed = 0; await threadsRepo.update(project, (md) => { const r = relinkThreadItems(md, from, to); changed = r.changed; return r.markdown; }); return changed; },
      addStops: (project, thread, stops) => editThread.addStops(project, thread, stops),
      removeFromThread: (project, thread, link) => editThread.removeRef(project, thread, link),
      addThread: (project, name) => editThread.addThread(project, name),
      removeThread: (project, name) => editThread.removeThread(project, name),
      renameThread: (project, from, to) => editThread.rename(project, from, to),
      setScale: (project, thread, words) => editThread.setScale(project, thread, words),
      renameScaleWord: (project, thread, from, to) => editThread.renameScaleWord(project, thread, from, to),
      setProjectKey: (project, key, value) => this.setTextKey(project.notePath, key, value),
      gridSettings: () => this.current.plotGrid,
      updateGridSettings: (next) => void this.updateSettings({ ...this.current, plotGrid: next }),
      sentences: async (project, scene) => {
        const note = (await projectNotes.notes(project)).find((n) => n.path === scene.path);
        const prose = note?.scenes.find((s) => s.line === scene.line && s.title === scene.title)?.prose ?? "";
        return prose.split(/\n\s*\n/).flatMap((para) => segmenter.segment(para).map((s) => s.text.trim())).filter(Boolean);
      },
      snapshot: (project) => snapshotPlotGrid.execute(project),
      exportGrid: (project) => snapshotPlotGrid.execute(project, false),
      readColumn: async (project, column, signal, onProgress) => {
        const { graph } = await buildPlotGrid.executeWithGraph(project);
        return new ReadColumn(projectNotes, storyRepo, this.columnAnalyser()).execute(project, column, graph, signal, onProgress);
      },
      checkColumn: async (project, column, signal, onProgress) => {
        const { graph } = await buildPlotGrid.executeWithGraph(project);
        return new ReadColumn(projectNotes, storyRepo, this.columnAnalyser()).check(project, column, graph, signal, onProgress);
      },
      proposeColumns: async (project, signal) => {
        const { grid, graph } = await buildPlotGrid.executeWithGraph(project);
        return new ProposeColumns(storyRepo, this.columnAnalyser()).execute(project, grid, graph, signal);
      },
      readProject: async (project, signal, onProgress) => {
        const cfg = this.current.llm;
        if (cfg.provider !== "ollama") throw new Error("Reading the project needs a local model — set Model to Local (Ollama) in Creative Writer settings.");
        const analyser = new OllamaRelationAnalyser(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
        const graph = await buildStoryMap.execute(project);
        return new AnalyzeSceneRelations(projectNotes, storyRepo, analyser).execute(project, null, graph, signal, onProgress);
      },
      dismissReading: async (project, scene, column) => { await storyRepo.update(project, (f) => setGridReadingState(f, scene, column, "dismissed")); },
      dismissColumnReadings: async (project, column) => { await storyRepo.update(project, (f) => dismissColumnReadings(f, column)); },
      modelLabel: () => { const cfg = this.current.llm; return cfg.provider === "ollama" ? `Ollama · ${cfg.ollamaModel}` : cfg.provider === "claude" ? `Claude · ${cfg.claudeModel}` : ""; },
    }));
    this.addCommand({ id: "open-story-timeline", name: COMMANDS["open-story-timeline"], callback: () => void this.openPlotGrid(null) });
    this.viewCommands(PlotGridView, [
      ["story-timeline-clear-search", "clear-search"], ["plot-grid-toggle-cast", "toggle-cast"], ["plot-grid-open-note", "open-note"], ["plot-grid-toggle-panel", "toggle-panel"], ["plot-grid-new-column", "new-column"],
      ["plot-grid-new-scene", "new-scene"], ["plot-grid-new-chapter", "new-chapter"], ["plot-grid-new-act", "new-act"], ["plot-grid-open-outline", "open-outline"], ["plot-grid-build-manuscript", "build-manuscript"], ["plot-grid-start-template", "start-template"], ["plot-grid-save-template", "save-template"],
      ["plot-grid-fold-arcs", "fold-arcs"], ["plot-grid-fold-themes", "fold-themes"], ["plot-grid-fold-subplots", "fold-subplots"], ["plot-grid-fold-threads", "fold-threads"],
      ["plot-grid-hide-column", "hide-column"], ["plot-grid-show-hidden", "show-hidden"], ["plot-grid-toggle-unmoved", "toggle-unmoved"], ["plot-grid-focus-search", "focus-search"], ["plot-grid-help", "help"],
      ["plot-grid-audit", "audit"], ["plot-grid-snapshot", "snapshot"], ["plot-grid-next-issue", "next-issue"], ["plot-grid-previous-issue", "previous-issue"], ["plot-grid-anchor", "anchor"],
      ["plot-grid-read-all", "read-all"], ["plot-grid-read-column", "read-column"], ["plot-grid-check-column", "check-column"], ["plot-grid-dismiss-reading", "dismiss-reading"], ["plot-grid-propose-columns", "propose-columns"], ["plot-grid-export", "export"],
      ["plot-grid-toggle-gauge", "toggle-gauge"], ["plot-grid-gauge-column", "gauge-column"], ["plot-grid-set-scale", "set-scale"],
    ]);
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
      readIntent: async (project, contradictions, signal, onProgress) => {
        const cfg = this.current.llm;
        if (cfg.provider !== "ollama") throw new Error("Reading for intent needs a local model — set Model to Local (Ollama) in Creative Writer settings.");
        const analyser = new OllamaIntentAnalyser(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
        return new AnalyzeContradictionIntent(projectNotes, storyRepo, analyser).execute(project, contradictions, signal, onProgress);
      },
      readEchoes: async (project, signal, onProgress) => {
        const cfg = this.current.llm;
        if (cfg.provider !== "ollama") throw new Error("Reading for echoes needs a local model — set Model to Local (Ollama) in Creative Writer settings.");
        const embedder = new OllamaEmbedder(new RequestUrlHttpClient(), { baseUrl: cfg.ollamaUrl, model: cfg.ollamaEmbedModel });
        const graph = await buildStoryMap.execute(project);
        return new AnalyzeProjectEchoes(projectNotes, storyRepo, embedder, new IntlSentenceSegmenter()).execute(project, graph, signal, onProgress);
      },
      dismiss: (project, key) => buildThreads.dismiss(project, key),
      undismiss: (project, key) => buildThreads.undismiss(project, key),
      addToThread: (project, thread, link, note) => editThread.addRef(project, thread, link, note),
      addStops: (project, thread, stops) => editThread.addStops(project, thread, stops),
      setStopRole: (project, thread, link, role) => editThread.setRole(project, thread, link, role),
      removeFromThread: (project, thread, link) => editThread.removeRef(project, thread, link),
      threadsNotePath: (project) => StoryThreadsNoteRepository.pathFor(project),
      storyColors: () => this.current.storyMap.colors,
      settings: () => this.current.threads,
      updateSettings: (next) => void this.updateSettings({ ...this.current, threads: next }),
      jumpTo: (to, project) => this.jumpTo(to, project),
    }));
    this.addCommand({ id: "open-story-threads", name: COMMANDS["open-story-threads"], callback: () => void this.openStoryThreads(null) });
    this.viewCommands(StoryThreadsView, [["story-threads-zoom-in", "zoom-in"], ["story-threads-zoom-out", "zoom-out"], ["story-threads-fit", "fit"], ["story-threads-open-note", "open-note"], ["story-threads-read-project", "read-project"], ["story-threads-gauge", "gauge"]]);
    this.addRibbonIcon("spline", "Open story threads", () => void this.openStoryThreads(null));
    this.addCommand({
      id: "read-note-for-story-threads",
      name: "Read this note for facts (story threads)",
      editorCallback: () => void this.openStoryThreads(null).then(() => (this.app.workspace.getLeavesOfType(STORY_THREADS_VIEW_TYPE)[0]?.view as StoryThreadsView | undefined)?.readActiveNote()),
    });
    this.addCommand({
      id: "read-contradictions-for-intent",
      name: COMMANDS["read-contradictions-for-intent"],
      callback: () => void this.openStoryThreads(null).then(() => (this.app.workspace.getLeavesOfType(STORY_THREADS_VIEW_TYPE)[0]?.view as StoryThreadsView | undefined)?.readIntent()),
    });
    this.addCommand({
      id: "read-project-for-echoes",
      name: COMMANDS["read-project-for-echoes"],
      callback: () => void this.openStoryThreads(null).then(() => (this.app.workspace.getLeavesOfType(STORY_THREADS_VIEW_TYPE)[0]?.view as StoryThreadsView | undefined)?.readEchoes()),
    });
    // Manuscript: the project's prose stitched into one read-only page; every note keeps its element and re-renders alone.
    const buildManuscript = new BuildManuscript(projectNotes, () => this.current.manuscript);
    const exportManuscript = new ExportManuscript(projectNotes, notes, () => this.current.manuscript);
    const manuscriptSegmenter = new IntlSentenceSegmenter();
    const exportNote = async (project: ProjectSpec): Promise<string> => {
      const { path, manuscript } = await exportManuscript.execute(project);
      new Notice(`creative-writer: ${manuscript.notes} note${manuscript.notes === 1 ? "" : "s"}, ${manuscript.words.toLocaleString()} words → ${path}`, 6000);
      return path;
    };
    this.registerView(MANUSCRIPT_VIEW_TYPE, (leaf: WorkspaceLeaf) => new ManuscriptView(leaf, {
      jumpTo: storySource.jumpTo,
      projects: storySource.projects,
      activeProject: storySource.activeProject,
      build: (project) => buildManuscript.execute(project),
      render: (markdown, el, sourcePath, view) => MarkdownRenderer.render(this.app, markdown, el, sourcePath, view),
      segment: (text) => manuscriptSegmenter.segment(text),
      reveal: (path, line, ch, focus) => void (focus ? this.revealPosition(path, line, ch) : this.followPosition(path, line, ch)),
      openLink: (link, sourcePath) => void this.app.workspace.openLinkText(link, sourcePath, false),
      settings: () => this.current.manuscript,
      updateSettings: (next) => void this.updateSettings({ ...this.current, manuscript: next }),
      exportNote,
      appendComment: (path, line, comment) => this.appendComment(path, line, comment),
      toggleResolved: (path, line, ch) => this.editNote(path, (text) => toggleResolved(text, line, ch)),
      // The same cast and conventions the dialogue lens uses, so the page and the editor agree on who speaks.
      voices: (project) => ({ roster: this.projectRosters()[project.scope] ?? [], conventions: resolveConventions(this.current.dialogue, this.projectConventions()[project.scope]), dimNarration: this.current.dialogue.dimNarration }),
      replaceLines: (path, from, to, text) => this.editNote(path, (all) => { const lines = all.split("\n"); lines.splice(from, to - from + 1, ...text.split("\n")); return lines.join("\n"); }),
      // Readability from the same profiler as the desk, today's words from the log, cast and contradictions from the map and threads.
      facts: async (project, paths, story, echoes = false, gauge = false) => {
        const texts = new Map((await projectNotes.notes(project)).map((n) => [n.path, n.text ?? ""]));
        const log = countedLog();
        const today = log.days[toDay(new Date())];
        const cast = story ? castFromGraph(await buildStoryMap.execute(project)) : new Map<string, never>();
        const sections = new Map<string, SectionFacts>();
        for (const path of paths) {
          const ease = profile.document(texts.get(path) ?? "").readingEase;
          const delta = today?.files[path];
          const c = cast.get(path);
          sections.set(path, { readability: ease ? { label: ease.band.label, score: ease.score } : null, today: { added: delta?.added ?? 0, removed: delta?.removed ?? 0 }, cast: c?.cast ?? [], scenes: c?.scenes ?? [] });
        }
        const threads = story || echoes || gauge ? await buildThreads.execute(project) : null;
        const marks = threads ? [...(story ? [...conflictMarks(threads.contradictions), ...threadMarks(threads.threads)] : []), ...(echoes ? echoMarks(threads.threads) : [])] : [];
        return { sections, marks, gauge: threads && gauge ? gaugeMarks(threads) : [] };
      },
      storyColors: () => this.current.storyMap.colors,
      promote: (project, name, kind) => this.createEntityNote(project.scope, name, kind),
      ignore: (project, name) => this.editList(project.notePath, "story-ignore", (list) => [...list.filter((n) => n !== name), name]),
    }));
    this.addCommand({ id: "open-manuscript", name: COMMANDS["open-manuscript"], callback: () => void this.openManuscript(null) });
    this.viewCommands(ManuscriptView, [["manuscript-prose-only", "prose-only"], ["manuscript-comments", "comments"], ["manuscript-ruler", "ruler"], ["manuscript-story", "story"], ["manuscript-echoes", "echoes"], ["manuscript-voices", "voices"], ["manuscript-gauge", "gauge"]]);
    this.addCommand({
      id: "return-to-manuscript",
      name: "Return to manuscript",
      // The way back from the editor: the page takes focus at the paragraph the cursor is in.
      callback: () => {
        const md = this.app.workspace.getActiveViewOfType(MarkdownView);
        const at = md?.file ? { path: md.file.path, line: md.editor.getCursor().line } : null;
        void this.openManuscript(null).then(() => {
          const view = this.app.workspace.getLeavesOfType(MANUSCRIPT_VIEW_TYPE)[0]?.view as ManuscriptView | undefined;
          view?.focusAt(at?.path ?? null, at?.line ?? 0);
        });
      },
    });
    this.addCommand({
      id: "export-manuscript",
      name: COMMANDS["export-manuscript"],
      callback: () => {
        const project = storySource.activeProject() ?? storySource.projects()[0];
        if (!project) { new Notice("creative-writer: no project — put story: true or writing-target in a note's front matter."); return; }
        void exportNote(project);
      },
    });
    this.addCommand({
      id: "insert-comment",
      name: "Insert comment here",
      // A selection is highlighted and the comment follows it; the cursor lands inside the comment, ready for a tag or a note.
      editorCallback: (editor) => {
        const selected = editor.getSelection();
        const from = editor.posToOffset(editor.getCursor("from"));
        const lead = selected ? `==${selected}== %% ` : "%% ";
        editor.replaceSelection(`${lead} %%`);
        editor.setCursor(editor.offsetToPos(from + lead.length));
      },
    });
    this.addRibbonIcon("book-open", "Open manuscript", () => void this.openManuscript(null));
    this.registerEvent(this.app.workspace.on("editor-change", (_editor, info) => { if (info.file) this.refreshManuscript(); }));
    this.registerEvent(this.app.vault.on("modify", (file) => { this.refreshManuscript(); if (this.wordListPaths.includes(file.path)) void this.reloadWordLists(); }));
    this.registerEvent(this.app.metadataCache.on("resolved", () => { this.refreshStoryMap(); this.refreshWriter(); this.pushProjectScopes(); void this.reloadWordLists(); }));
    this.registerEvent(this.app.vault.on("rename", () => this.refreshStoryMap()));
    this.registerEvent(this.app.vault.on("delete", () => this.refreshStoryMap()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshDesk()));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (file && md?.file === file) this.observe(file.path, md.editor.getValue());
    }));
    this.registerEvent(this.app.workspace.on("editor-change", (editor, info) => {
      const text = editor.getValue();
      if (info.file && this.scope.counts(info.file.path, text)) this.tracker.changed(info.file.path, countWords(text));
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.tracker.renamed(oldPath, file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.tracker.deleted(file.path)));
    // The log lives in the vault, and on "Reload app without saving" the plugin loads before the vault is indexed:
    // read it too early and the note looks missing, so the legacy import would recreate its folder (which throws) and
    // overwrite the real log. Nothing touches the vault until the layout — and with it the file index — is ready.
    this.app.workspace.onLayoutReady(() => void this.tracker.start().then(() => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (md?.file) this.observe(md.file.path, md.editor.getValue());
      void this.reloadWordLists();
      void this.maybeShowReleaseNote();
    }));

    const readability = this.addStatusBarItem();
    readability.addClass("czm-status-readability");
    readability.setAttribute("aria-label", "Readability of the current paragraph. Click for the whole note.");
    readability.setAttribute("role", "button");
    readability.tabIndex = 0;
    readability.addEventListener("click", () => void this.openDesk());
    readability.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); void this.openDesk(); } });

    this.registerEditorExtension([
      this.settingsCompartment.of(settingsFacet.of(this.current)),
      this.projectsCompartment.of(projectScopesFacet.of(this.projectScopes())),
      this.wordsCompartment.of(wordListsFacet.of(EMPTY_WORD_LISTS)),
      this.conventionsCompartment.of(conventionsFacet.of(this.projectConventions())),
      this.rostersCompartment.of(rostersFacet.of(this.projectRosters())),
      activeNoteExtension((state) => state.field(editorInfoField, false)?.file?.path ?? null),
      lensExtension(),
      dialogueExtension((state) => state.field(editorInfoField, false)?.file?.path ?? null, { editAccent: (speaker, list, term, add) => void this.editAccent(speaker, list, term, add) }),
      wordsExtension((state) => state.field(editorInfoField, false)?.file?.path ?? null, { removeTerm: (path, term) => void this.editNote(path, (text) => removeTerm(text, term)) }),
      readabilityStatusExtension(profile, (p) => {
        readability.setText(statusLabel(p));
        readability.setAttribute("aria-label", `${p?.readingEase ? `${p.readingEase.band.hint}${p.variety ? ` ${p.variety.band.hint}` : ""} ` : ""}Readability of the current paragraph. Click for the whole note.`);
      }),
      typewriterExtension(),
      currentLineExtension(),
      focusFadeExtension(),
      rhythmExtension(new AnalyzeParagraphRhythm(new IntlSentenceSegmenter())),
      styleExtension(AnalyzeParagraphStyle.withDefaultRules(new CompromiseTagger(), new BrysbaertConcreteness())),
      commentTagExtension(),
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
          new Notice(`creative-writer: the model could not read the paragraph: ${e instanceof Error ? e.message : String(e)}. Check Settings → Model assistant, or turn "Analyse automatically" off.`, 8000);
        },
      }),
    ]);

    this.addSettingTab(
      new CreativeZenSettingsTab(this.app, this, {
        current: () => this.current,
        update: (next) => this.updateSettings(next),
        configDir: () => this.app.vault.configDir,
        scopeSummary: () => this.scopeSummary(),
      }),
    );
  }

  /** Switch the lens (and, from the menu, a lens switch with it); the status bar follows, a notice says what happened. */
  private async setLens(lens: Lens, next: PluginSettings = this.current): Promise<void> {
    const changed = lens !== this.current.lens;
    await this.updateSettings({ ...next, lens });
    if (!changed) return;
    if (lens === "words" && this.wordListsKey === "") new Notice(`Lens: words — no word list yet. Write one at ${this.current.words.note}: a heading per category, the words under it.`, 8000);
    else new Notice(`Lens: ${LENS_LABELS[lens].toLowerCase()}`);
  }

  private renderLensStatus(): void {
    const el = this.lensStatus;
    if (!el) return;
    const lens = this.current.lens;
    el.setText(lens === "none" ? "No lens" : `Lens: ${LENS_LABELS[lens].toLowerCase()}`);
    el.classList.toggle("is-off", lens === "none");
    el.setAttribute("aria-label", `${lens === "none" ? "No lens" : `Lens: ${LENS_LABELS[lens]}`}. Click to choose a lens.`);
  }

  /** Reads the global word list note and every project's own, and pushes them into the editors when something changed. */
  private async reloadWordLists(): Promise<void> {
    const vault = this.app.vault;
    const notes = vaultNoteIO(vault);
    const projects = vault.getMarkdownFiles()
      .map((f) => parseProjectFrontmatter(this.app.metadataCache.getFileCache(f)?.frontmatter, f.path))
      .filter((s): s is ProjectSpec => s !== null);
    const loaded = await loadWordLists({
      exists: (p) => notes.exists(p),
      read: (p) => notes.read(p),
      resolveLink: (link, from) => this.app.metadataCache.getFirstLinkpathDest(link.replace(/\.md$/i, ""), from)?.path ?? null,
    }, this.current.words.note, projects);
    this.wordListPaths = loaded.paths;
    this.wordLists = loaded.lists;
    const key = JSON.stringify(loaded.lists);
    if (key === this.wordListsKey) return;
    this.wordListsKey = loaded.paths.length === 0 ? "" : key;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const editor = (leaf.view as { editor?: { cm?: { dispatch: (spec: unknown) => void } } }).editor;
      editor?.cm?.dispatch({ effects: this.wordsCompartment.reconfigure(wordListsFacet.of(loaded.lists)) });
    });
  }

  /** `term` into the word list note under `category`; the note is created when it is not there yet. */
  private async addWord(note: string, category: string, term: string): Promise<void> {
    const io = vaultNoteIO(this.app.vault);
    if (!(await io.exists(note))) await io.write(note, "");
    await this.editNote(note, (text) => addTerm(text, category, term));
    new Notice(`Words: "${term}" under ${category} in ${note}`);
    await this.reloadWordLists();
  }

  /** A word into, or out of, a character note's accent list; a speaker with no note (a bare pin) has nowhere to keep it. */
  private async editAccent(speaker: Speaker, list: "accent" | "accent-never", term: string, add: boolean): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(speaker.id);
    if (!(file instanceof TFile)) { new Notice(`creative-writer: ${speaker.name} has no character note to keep the accent in.`); return; }
    const word = term.trim().toLowerCase();
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const raw = fm[list];
      const items = (Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
      const next = add ? (items.some((x) => x.toLowerCase() === word) ? items : [...items, word]) : items.filter((x) => x.toLowerCase() !== word);
      if (next.length) fm[list] = next; else delete fm[list];
    });
    new Notice(add ? `Accents: "${word}" is ${speaker.name}'s${list === "accent-never" ? " never-say" : ""}` : `Accents: "${word}" removed from ${speaker.name}`);
  }

  /** A note came into view: its size is the baseline for what follows, even if the scope later lets it in. */
  private observe(path: string, text: string): void {
    if (this.scope.counts(path, text)) this.tracker.opened(path, countWords(text));
  }

  /** Every declared project, `story: true` ones included — they are the story too. */
  private projectSpecs(): ProjectSpec[] {
    return this.app.vault
      .getMarkdownFiles()
      .map((f) => parseProjectFrontmatter(this.app.metadataCache.getFileCache(f)?.frontmatter, f.path))
      .filter((s): s is ProjectSpec => s !== null);
  }

  /** Every declared project's folder (or note). */
  private projectScopes(): string[] {
    return this.projectSpecs().map((s) => s.scope);
  }

  /** The dialogue conventions project notes declare, by scope, for the dialogue lens. */
  private projectConventions(specs: readonly ProjectSpec[] = this.projectSpecs()): ConventionsByScope {
    const out: Record<string, ReturnType<typeof projectConventions>> = {};
    for (const s of specs) { const c = projectConventions(s); if (Object.keys(c).length) out[s.scope] = c; }
    return out;
  }

  /** The cast per project, its own character notes only, for the dialogue lens. */
  private projectRosters(specs: readonly ProjectSpec[] = this.projectSpecs()): RostersByScope {
    const notes: EntityNote[] = this.app.vault.getMarkdownFiles().map((f) => ({ path: f.path, frontmatter: this.app.metadataCache.getFileCache(f)?.frontmatter }));
    const out: Record<string, ReturnType<typeof buildRoster>> = {};
    for (const s of specs) out[s.scope] = buildRoster(notes, s.scope, s.speakers);
    return out;
  }

  /** Editors decide activation from the project list under the "projects" scope mode, and read the projects' conventions and casts; push them only when they change. */
  private pushProjectScopes(): void {
    const specs = this.projectSpecs();
    const scopes = specs.map((s) => s.scope);
    const conventions = this.projectConventions(specs);
    const rosters = this.projectRosters(specs);
    const key = JSON.stringify([scopes, conventions, rosters]);
    if (key === this.projectScopesKey) return;
    this.projectScopesKey = key;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const editor = (leaf.view as { editor?: { cm?: { dispatch: (spec: unknown) => void } } }).editor;
      editor?.cm?.dispatch({ effects: [
        this.projectsCompartment.reconfigure(projectScopesFacet.of(scopes)),
        this.conventionsCompartment.reconfigure(conventionsFacet.of(conventions)),
        this.rostersCompartment.reconfigure(rostersFacet.of(rosters)),
      ] });
    });
  }

  /** For the settings tab: how many notes the current rule takes in. */
  private scopeSummary(): { counted: number; total: number } {
    const files = this.app.vault.getMarkdownFiles();
    return { counted: files.filter((f) => this.scope.counts(f.path)).length, total: files.length };
  }

  /** Projects are declared in front matter; totals come from the vault, not the log, so untracked files count too. */
  private async projectStatuses(log: WritingLog): Promise<ProjectStatus[]> {
    const files = this.app.vault.getMarkdownFiles();
    const specs = files
      .map((f) => parseProjectFrontmatter(this.app.metadataCache.getFileCache(f)?.frontmatter, f.path))
      .filter((s): s is NonNullable<typeof s> => s !== null && s.targetWords > 0) // `story: true` projects have nothing to pace
      .sort((a, b) => a.name.localeCompare(b.name));
    if (specs.length === 0) return [];
    const counts = new Map<string, number>();
    for (const f of files) {
      if (!specs.some((s) => inScope(s, f.path)) || !this.scope.counts(f.path)) continue;
      counts.set(f.path, countWords(await this.app.vault.cachedRead(f)));
    }
    const today = toDay(new Date());
    return specs.map((spec) => {
      let total = 0;
      for (const [path, words] of counts) if (inScope(spec, path)) total += words;
      return projectStatus(spec, total, recentAdded(log, spec, today, 7), today, projectStreak(log, spec, today));
    });
  }

  private async openDesk(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(DESK_VIEW_TYPE)[0] ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: DESK_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    (leaf.view as DeskView).refresh();
  }

  /**
   * The myth analysis found an archetype: attach it to an archetype card on
   * the writer board as a REF at the cursor, or make it a new archetype
   * note. One-way, story to writer; the board never feeds the model.
   */
  private async archetypeToWriter(a: Archetype): Promise<void> {
    const file = await this.writer!.repo.load();
    const board = await this.writer!.board.boardFor(file);
    const cards = board.cards.filter((c) => c.groups.includes("archetype")).map((c) => ({ path: c.path, title: c.title, groups: c.groups.join(", ") }));
    const NEW = "\u0000new";
    const items = [{ path: NEW, title: `New archetype note: ${a.name}`, groups: "in the stories folder, tagged" }, ...cards];
    const chosen = await new Promise<string | null>((resolve) => new CardPicker(this.app, items, resolve).open());
    if (!chosen) return;
    if (chosen === NEW) {
      const path = await this.writer!.source.createNote(a.name, "archetype");
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) await this.app.vault.process(f, (text) => `${text}# ${a.name}\n\n${a.character ? `${a.character}, in the scene the model read.\n\n` : ""}> ${a.evidence}\n`);
      void this.app.workspace.openLinkText(path, "", false);
      new Notice(`creative-writer: ${a.name} is on the writer board.`);
      return;
    }
    const md = this.app.workspace.getActiveViewOfType(MarkdownView);
    const name = chosen.slice(chosen.lastIndexOf("/") + 1).replace(/\.md$/i, "");
    if (!md) { new Notice(`creative-writer: open the scene in an editor to place the REF to ${name}.`); return; }
    const editor = md.editor;
    const to = editor.getCursor("to");
    editor.replaceRange(` %% REF: [[${name}]] %%`, to);
    new Notice(`creative-writer: REF to ${name} placed at the cursor.`);
  }

  private async openWriter(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(WRITER_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: WRITER_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    await (leaf.view as WriterView).refresh();
  }

  private writerTimer: number | null = null;
  private writer: { repo: WriterFileRepository; board: BuildWriterBoard; source: WriterSource } | null = null;
  /** The board follows the vault: a tag added by hand shows on the next metadata pass. */
  private refreshWriter(): void {
    if (this.writerTimer !== null) window.clearTimeout(this.writerTimer);
    this.writerTimer = window.setTimeout(() => {
      this.writerTimer = null;
      for (const leaf of this.app.workspace.getLeavesOfType(WRITER_VIEW_TYPE)) void (leaf.view as WriterView).refresh();
    }, 400);
  }

  private async openStoryMap(project: ProjectSpec | null = null): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(STORY_MAP_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: STORY_MAP_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as StoryMapView;
    if (project) await view.show(project); else await view.onOpen();
  }

  /** The jumps in every panel's head: the same six, in the same order, carrying the project where the target takes one. */
  private jumpTo(to: PanelId, project: ProjectSpec | null): void {
    switch (to) {
      case "desk": void this.openDesk(); break;
      case "board": void this.openWriter(); break;
      case "map": void this.openStoryMap(project); break;
      case "timeline": void this.openPlotGrid(project); break;
      case "threads": void this.openStoryThreads(project); break;
      case "manuscript": void this.openManuscript(project); break;
    }
  }

  private async openPlotGrid(project: ProjectSpec | null): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PLOT_GRID_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("split", "vertical");
    if (!existing) await leaf.setViewState({ type: PLOT_GRID_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as PlotGridView;
    if (project) await view.show(project); else await view.onOpen();
  }

  private async openManuscript(project: ProjectSpec | null): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(MANUSCRIPT_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("split", "vertical");
    if (!existing) await leaf.setViewState({ type: MANUSCRIPT_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as ManuscriptView;
    if (project) await view.show(project); else await view.onOpen();
  }

  private manuscriptRefreshTimer: number | null = null;
  /** Typing fires on every keystroke; the page only needs to follow after a short pause. */
  private refreshManuscript(): void {
    if (this.app.workspace.getLeavesOfType(MANUSCRIPT_VIEW_TYPE).length === 0) return;
    if (this.manuscriptRefreshTimer !== null) window.clearTimeout(this.manuscriptRefreshTimer);
    this.manuscriptRefreshTimer = window.setTimeout(() => {
      this.manuscriptRefreshTimer = null;
      for (const l of this.app.workspace.getLeavesOfType(MANUSCRIPT_VIEW_TYPE)) void (l.view as ManuscriptView).refresh();
    }, 600);
  }

  /**
   * Appends ` %% comment %%` to the end of a line — through the editor when the note is open, so no
   * unsaved keystroke is lost, else on disk. The manuscript page refreshes from either path.
   */
  private async appendComment(path: string, line: number, comment: string): Promise<void> {
    const insert = ` %% ${comment.replace(/%%/g, "").trim()} %%`;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) {
        const at = Math.min(line, view.editor.lastLine());
        view.editor.replaceRange(insert, { line: at, ch: view.editor.getLine(at).length });
        return;
      }
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n");
      const at = Math.min(line, lines.length - 1);
      lines[at] = `${lines[at]}${insert}`;
      return lines.join("\n");
    });
  }

  /** A panel's actions as commands, named from the one table the ⋯ menus read; live only while that panel is the active view. */
  private viewCommands<A extends string, V extends View & { run(action: A): void }>(type: Constructor<V>, actions: readonly (readonly [CommandId, A])[]): void {
    for (const [id, action] of actions) {
      this.addCommand({ id, name: COMMANDS[id], checkCallback: (checking) => { const view = this.app.workspace.getActiveViewOfType(type); if (!view) return false; if (!checking) view.run(action); return true; } });
    }
  }

  /** Rewrites a note through its open editor when one shows it, so no unsaved keystroke is lost, else on disk. */
  private async editNote(path: string, change: (text: string) => string): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) {
        const before = view.editor.getValue();
        const after = change(before);
        if (after === before) return;
        // Replace only the span that changed, so the cursor, the scroll and the undo history stay.
        let start = 0;
        while (start < before.length && start < after.length && before[start] === after[start]) start++;
        let endB = before.length, endA = after.length;
        while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) { endB--; endA--; }
        view.editor.replaceRange(after.slice(start, endA), view.editor.offsetToPos(start), view.editor.offsetToPos(endB));
        return;
      }
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, change);
  }

  /** The text of a note as an open editor has it, or null when no editor shows it. */
  private editorText(path: string): string | null {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) return view.editor.getValue();
    }
    return null;
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
    const open = ws.getLeavesOfType(STORY_MAP_VIEW_TYPE).length + ws.getLeavesOfType(PLOT_GRID_VIEW_TYPE).length + ws.getLeavesOfType(STORY_THREADS_VIEW_TYPE).length;
    if (open === 0) return;
    if (this.storyMapRefreshTimer !== null) window.clearTimeout(this.storyMapRefreshTimer);
    this.storyMapRefreshTimer = window.setTimeout(() => {
      this.storyMapRefreshTimer = null;
      for (const l of ws.getLeavesOfType(STORY_MAP_VIEW_TYPE)) void (l.view as StoryMapView).refresh();
      for (const l of ws.getLeavesOfType(PLOT_GRID_VIEW_TYPE)) void (l.view as PlotGridView).refresh();
      for (const l of ws.getLeavesOfType(STORY_THREADS_VIEW_TYPE)) void (l.view as StoryThreadsView).refresh();
      for (const l of ws.getLeavesOfType(MANUSCRIPT_VIEW_TYPE)) void (l.view as ManuscriptView).refresh();
    }, 2000);
  }

  /** Opens the note and puts the cursor on a scene's heading line. */
  private revealScene(path: string, line: number): Promise<void> {
    return this.revealPosition(path, line, 0);
  }

  /**
   * The editor follows a selection on the manuscript page without taking focus: the editor already showing
   * the note, else the most recent editor in the main area (its file swapped, the way the file explorer
   * does it), else a new split beside the page.
   */
  private async followPosition(path: string, line: number, ch: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType("markdown").find((l) => l.view instanceof MarkdownView && l.view.file?.path === path);
    if (!leaf) {
      const recent = ws.getMostRecentLeaf();
      leaf = recent?.view instanceof MarkdownView ? recent
        : ws.getLeavesOfType("markdown").find((l) => l.getRoot() === ws.rootSplit) ?? ws.getLeaf("split", "vertical");
      await leaf.openFile(file, { active: false });
    }
    const md = leaf.view instanceof MarkdownView ? leaf.view : null;
    if (!md) return;
    md.editor.setCursor({ line, ch });
    md.editor.scrollIntoView({ from: { line, ch }, to: { line, ch } }, true);
  }

  /**
   * Opens the note in the editor already showing it, else in the current
   * leaf when that is an editor, else beside the caller: a click in a story
   * view must never replace that view with the note.
   */
  private async revealPosition(path: string, line: number, ch: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    let leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => l.view instanceof MarkdownView && l.view.file?.path === path);
    if (!leaf) {
      const current = this.app.workspace.getLeaf(false);
      const type = current.view.getViewType();
      leaf = type === "markdown" || type === "empty" ? current : this.app.workspace.getLeaf("split", "vertical");
    }
    await leaf.openFile(file, { active: true });
    const md = leaf.view instanceof MarkdownView ? leaf.view : null;
    if (!md) return;
    md.editor.setCursor({ line, ch });
    md.editor.scrollIntoView({ from: { line, ch }, to: { line, ch } }, true);
    md.editor.focus();
  }

  /**
   * The plot grid's column reader for the configured model: Ollama, or
   * Claude with the same daily cap the style assistant honours, counted in
   * the same ledger. Resolved at call time, so a change in settings takes
   * effect on the next pass.
   */
  private columnAnalyser(): ColumnAnalyser {
    const cfg = this.current.llm;
    const http = new RequestUrlHttpClient();
    if (cfg.provider === "ollama") return new OllamaColumnAnalyser(http, { baseUrl: cfg.ollamaUrl, model: cfg.ollamaModel });
    if (cfg.provider !== "claude") throw new Error("Reading needs a model: set Model to Local (Ollama) or Claude in Creative Writer settings.");
    const claude = new ClaudeColumnAnalyser(http, { apiKey: cfg.claudeApiKey, model: cfg.claudeModel });
    const ledger = CostLedger.fromPersisted(cfg.spend);
    const priced = async (call: () => Promise<unknown>) => {
      if (ledger.capReached(cfg.dailyCapUsd)) throw new Error(`Claude: daily cap of $${cfg.dailyCapUsd.toFixed(2)} reached. Raise it in settings or wait until tomorrow.`);
      const out = await call();
      const price = PRICES[cfg.claudeModel];
      if (claude.lastUsage && price) { ledger.add(costOf(claude.lastUsage, price)); void this.updateSettings({ ...this.current, llm: { ...this.current.llm, spend: ledger.persisted() } }); }
      return out;
    };
    return {
      name: claude.name,
      rulebook: claude.rulebook,
      read: (text, present, column, signal) => priced(() => claude.read(text, present, column, signal)),
      check: (text, plan, column, signal) => priced(() => claude.check(text, plan, column, signal)),
      propose: (brief, signal) => priced(() => claude.propose(brief, signal)),
    };
  }

  /** Writes or clears one text property in a note's front matter — the project note's `plot-pov`, `plot-time`, `plot-theme`. */
  private async setTextKey(path: string, key: string, value: string | null): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`${path} is not a note`);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (value && value.trim()) fm[key] = value.trim(); else delete fm[key];
    });
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
  /** The markdown view of the last active file, when it is still open somewhere. */
  private lastMarkdownView(): MarkdownView | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) return view;
    }
    return null;
  }

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

  /**
   * Once after install, once after a minor or major update, never while Zen Mode is on (next launch, then).
   * The seen version is saved before the modal opens, so a crash costs one note, never a recurring one.
   */
  private async maybeShowReleaseNote(): Promise<void> {
    if (this.zen.isActive) return;
    const note = this.current.releaseNote;
    const { kind, seen } = releaseNoteDecision(note.seenVersion, this.manifest.version, note.enabled);
    if (seen !== note.seenVersion) await this.updateSettings({ ...this.current, releaseNote: { ...note, seenVersion: seen } });
    if (kind) this.openReleaseNote(kind);
  }

  private openReleaseNote(kind: "welcome" | "update"): void {
    new ReleaseNoteModal(this.app, kind, this.manifest.version, (url) => { window.open(url); }).open();
  }

  private async updateSettings(next: PluginSettings): Promise<void> {
    const manuscriptChanged = next.manuscript !== this.current.manuscript;
    const wordsNoteChanged = next.words.note !== this.current.words.note;
    this.current = next;
    if (manuscriptChanged) this.refreshManuscript();
    this.renderLensStatus();
    if (wordsNoteChanged) void this.reloadWordLists();
    await this.settingsRepo.save(next);
    // Push the new settings into every open editor; extensions react via the facet.
    this.app.workspace.iterateAllLeaves((leaf) => {
      const editor = (leaf.view as { editor?: { cm?: { dispatch: (spec: unknown) => void } } }).editor;
      editor?.cm?.dispatch({ effects: this.settingsCompartment.reconfigure(settingsFacet.of(next)) });
    });
  }
}

/** The selection, or the word under the cursor. */
function wordAtCursor(editor: Editor): string | null {
  const selected = editor.getSelection().trim();
  if (selected) return selected;
  const range = editor.wordAt(editor.getCursor());
  return range ? editor.getRange(range.from, range.to).trim() || null : null;
}

/** Which category the word goes under: the list's headings, or a new one typed in. */
class CategoryModal extends FuzzySuggestModal<string> {
  constructor(app: App, private readonly categories: readonly string[], word: string, private readonly onPick: (category: string) => void) {
    super(app);
    this.setPlaceholder(`A category for "${word}"…`);
  }
  getItems(): string[] { return [...this.categories]; }
  getItemText(item: string): string { return item; }
  getSuggestions(query: string): FuzzyMatch<string>[] {
    const found = super.getSuggestions(query);
    const q = query.trim();
    if (q && !this.categories.some((c) => c.toLowerCase() === q.toLowerCase())) found.push({ item: q, match: { score: 0, matches: [] } });
    return found;
  }
  renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
    el.setText(this.categories.includes(match.item) ? match.item : `New category: ${match.item}`);
  }
  onChooseItem(item: string): void { this.onPick(item); }
}
