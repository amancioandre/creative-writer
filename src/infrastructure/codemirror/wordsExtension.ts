import { Facet, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { activeChanged, effectiveSettings } from "./activeNote";
import { settingsChanged } from "./settingsFacet";
import { findingProviders, type HoverFinding } from "./findingsTooltip";
import { categoryColour, WordMatcher, type WordCategory, type WordMatch } from "../../domain/words/WordList";
import { pathInScope } from "../../domain/scope/NoteScope";

/** The word lists the host has read: the vault-wide note, and a project's own note by project scope. */
export interface WordLists {
  readonly vault: readonly WordCategory[];
  readonly byScope: Readonly<Record<string, readonly WordCategory[]>>;
  /** Where each list came from, so an edit from the box lands in the right note. */
  readonly vaultPath?: string | null;
  readonly scopePaths?: Readonly<Record<string, string>>;
}

export const EMPTY_WORD_LISTS: WordLists = { vault: [], byScope: {} };

/** What the box can do to a list; the host supplies it, with the vault behind it. */
export interface WordsActions {
  removeTerm(notePath: string, term: string): void;
}

export const wordListsFacet = Facet.define<WordLists, WordLists>({
  combine: (values) => values[values.length - 1] ?? EMPTY_WORD_LISTS,
});

export const WORDS_MARK_CLASS = "czm-words";

function scopeFor(lists: WordLists, path: string | null): string | null {
  let best: string | null = null;
  if (path !== null) for (const scope of Object.keys(lists.byScope)) if (pathInScope(path, scope) && (best === null || scope.length > best.length)) best = scope;
  return best;
}

/** A note inside a project that names its own list uses that; the most specific scope wins; everything else uses the vault-wide note. */
export function listsFor(lists: WordLists, path: string | null): readonly WordCategory[] {
  const best = scopeFor(lists, path);
  return best === null ? lists.vault : lists.byScope[best]!;
}

/** The note the list for `path` was read from, when the host said. */
export function sourceOf(lists: WordLists, path: string | null): string | null {
  const best = scopeFor(lists, path);
  return (best === null ? lists.vaultPath : lists.scopePaths?.[best]) ?? null;
}

const matchers = new WeakMap<readonly WordCategory[], WordMatcher>();
function matcherFor(categories: readonly WordCategory[]): WordMatcher {
  let m = matchers.get(categories);
  if (!m) { m = new WordMatcher(categories); matchers.set(categories, m); }
  return m;
}

/**
 * The Words lens: every term of the writer's own lists, tinted by category,
 * in the visible part of the editor. Work is bounded by the viewport; the
 * per-note count in the tooltip is computed only on hover.
 */
export function wordsExtension(pathOf: (state: EditorState) => string | null, actions: WordsActions | null = null) {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    /** Absolute offsets, in document order, for the tooltip. */
    matches: WordMatch[] = [];
    matcher: WordMatcher | null = null;
    constructor(view: EditorView) { this.compute(view); }
    update(u: ViewUpdate) {
      const listsChanged = u.startState.facet(wordListsFacet) !== u.state.facet(wordListsFacet);
      if (u.docChanged || u.viewportChanged || settingsChanged(u) || activeChanged(u) || listsChanged) this.compute(u.view);
    }
    private compute(view: EditorView) {
      this.matches = [];
      this.matcher = null;
      if (effectiveSettings(view.state).lens !== "words") { this.decorations = Decoration.none; return; }
      const categories = listsFor(view.state.facet(wordListsFacet), pathOf(view.state));
      const matcher = matcherFor(categories);
      if (matcher.empty) { this.decorations = Decoration.none; return; }
      this.matcher = matcher;
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        for (const m of matcher.findAll(view.state.sliceDoc(from, to))) {
          const abs = { ...m, from: from + m.from, to: from + m.to };
          this.matches.push(abs);
          builder.add(abs.from, abs.to, Decoration.mark({ class: WORDS_MARK_CLASS, attributes: { style: `--czm-words: ${categoryColour(categories[m.category]!, m.category)}` } }));
        }
      }
      this.decorations = builder.finish();
    }
    /** The visible matches as hover findings: the category and how often the term occurs in the whole note. */
    findings(view: EditorView): HoverFinding[] {
      const matcher = this.matcher;
      if (!matcher || this.matches.length === 0) return [];
      const counts = new Map<string, number>();
      for (const m of matcher.findAll(view.state.doc.toString())) counts.set(m.term, (counts.get(m.term) ?? 0) + 1);
      const source = sourceOf(view.state.facet(wordListsFacet), pathOf(view.state));
      return this.matches.map((m) => {
        const n = counts.get(m.term) ?? 1;
        const category = matcher.categories[m.category]!.name;
        const f: HoverFinding = { from: m.from, to: m.to, kind: "words", note: `${category} · ${n} in this note` };
        return actions && source ? { ...f, actions: [{ label: `Remove "${m.term}" from ${category}`, run: () => actions.removeTerm(source, m.term) }] } : f;
      });
    }
  }, { decorations: (v) => v.decorations });

  return [plugin, findingProviders.of((view) => view.plugin(plugin)?.findings(view) ?? [])];
}
