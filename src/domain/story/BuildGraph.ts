import { countWords } from "../text/Dialogue";
import type { Scene } from "../text/Scenes";
import { EntityIndex, NameLookup, basenameOf, normalise } from "./EntityIndex";
import { NOT_A_NAME, findMentions, unresolvedCounts } from "./Mentions";
import type { PosTagger } from "../style/PosTagger";
import { type Edge, type EdgeKind, type Entity, type SceneRef, type StoryGraph, type TimelineRow, layerOf, pairKey, sceneKey, textHash } from "./StoryGraph";
import type { StoryMapFile } from "./StoryMapFile";

/** A note of the project as the builder sees it — already read and parsed by the caller. */
export interface ProjectNote {
  readonly path: string;
  readonly frontmatter: unknown;
  /** Resolved paths of notes this one links to (wikilinks, markdown links, embeds). */
  readonly links: readonly string[];
  readonly bookmarked: boolean;
  /** Headings bookmarked in this note. */
  readonly bookmarkedHeadings: readonly string[];
  readonly scenes: readonly Scene[];
}

export interface BuildOptions {
  /** Unknown names mentioned at least this often become candidate entities. */
  readonly candidateMinMentions: number;
  /** Optional: vetoes candidates whose words are pronouns, verbs, adjectives, numbers… rather than names. */
  readonly tagger?: PosTagger;
  /** Normalised surface forms the writer said are not names. */
  readonly ignore?: ReadonlySet<string>;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = { candidateMinMentions: 3 };

/** Tags that mean "this capitalised word is not somebody's name". */
const NOT_NAME_TAGS = ["Pronoun", "Conjunction", "Preposition", "Determiner", "Modal", "Auxiliary", "QuestionWord", "Expression", "Value", "Cardinal", "Ordinal", "Copula", "Negative", "Adverb", "Gerund", "Comparative", "Superlative"];
const PARTICLES = new Set(["of", "the", "de", "da", "do", "di", "van", "von", "der", "den", "la", "le", "del", "y", "e"]);

/**
 * Could this surface form be a name? Every word is checked: none may be
 * a stop word, and with a tagger none may be a function word, a bare
 * verb or a bare adjective. "Bear" (noun) passes; "Waiting" (gerund),
 * "Better" (comparative) and "Twelve" (value) do not.
 */
export function looksLikeName(surface: string, tagger?: PosTagger): boolean {
  const words = surface.split(/\s+/).filter((w) => !PARTICLES.has(w.toLowerCase()));
  if (words.length === 0) return false;
  if (words.some((w) => NOT_A_NAME.has(normalise(w)))) return false;
  if (!tagger) return true;
  const isNoun = (tags: ReadonlySet<string>) => tags.has("Noun") || tags.has("ProperNoun") || tags.has("Singular") || tags.has("Plural");
  for (const w of words) {
    for (const tok of tagger.tag(w)) {
      if (NOT_NAME_TAGS.some((t) => tok.tags.has(t))) return false;
      if (isNoun(tok.tags)) continue;
      if (tok.tags.has("Adjective")) return false; // "Disgusting", "Silent" — an exclamation, not a person
      if (!tok.tags.has("Verb")) continue;
      // "Bear" alone reads as a verb; "the Bear" reads as a noun. A word that can be a thing may be a name.
      const framed = tagger.tag(`the ${w}`).find((t) => t.normal !== "the");
      if (!framed || !isNoun(framed.tags) || framed.tags.has("Gerund")) return false;
    }
  }
  return true;
}

/**
 * Builds the whole graph from the project's notes. Deterministic: same
 * notes, same graph, on any device. Model readings (`file`) are layered
 * on top and marked stale where the scene has moved on since.
 */
export function buildStoryGraph(project: string, notes: readonly ProjectNote[], file: StoryMapFile, options: BuildOptions = DEFAULT_BUILD_OPTIONS): StoryGraph {
  const sorted = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const index = new EntityIndex(sorted);
  const isSceneNote = (note: ProjectNote) => !index.entities.some((e) => e.path === note.path); // an entity's own note is not a scene

  // Pass 1: unknown names seen mid-sentence anywhere become familiar, so pass 2 can count them at sentence start too.
  const familiar = new Set<string>();
  for (const note of sorted) if (isSceneNote(note)) for (const scene of note.scenes) {
    for (const m of findMentions(scene.prose, index)) if (!m.entityId) familiar.add(normalise(m.surface));
  }

  // Pass 2: mentions per scene, resolved or not.
  const sceneMentions: { note: ProjectNote; scene: Scene; ref: SceneRef; ids: Set<string>; surfaces: Map<string, string>; mentionCount: Map<string, number> }[] = [];
  const allUnresolved = [];
  for (const note of sorted) {
    if (!isSceneNote(note)) continue;
    for (const scene of note.scenes) {
      const mentions = findMentions(scene.prose, index, familiar);
      const ids = new Set<string>();
      const surfaces = new Map<string, string>();
      const mentionCount = new Map<string, number>();
      for (const m of mentions) {
        const id = m.entityId ?? `name:${normalise(m.surface)}`;
        ids.add(id);
        mentionCount.set(id, (mentionCount.get(id) ?? 0) + 1);
        if (!m.entityId) surfaces.set(id, m.surface);
      }
      allUnresolved.push(...mentions.filter((m) => !m.entityId));
      sceneMentions.push({ note, scene, ref: { path: note.path, title: scene.title, line: scene.line }, ids, surfaces, mentionCount });
    }
  }

  // Candidates: unknown names that recur enough to be somebody.
  const candidateIds = new Set<string>();
  const candidateSurface = new Map<string, string>();
  for (const [key, { surface, count }] of unresolvedCounts(allUnresolved)) {
    if (count < options.candidateMinMentions) break;
    if (options.ignore?.has(key)) continue;
    if (!looksLikeName(surface, options.tagger)) continue;
    candidateIds.add(`name:${key}`);
    candidateSurface.set(`name:${key}`, surface);
  }
  const isNode = (id: string) => !id.startsWith("name:") || candidateIds.has(id);

  // Entities: typed notes, candidates, plain notes (chapters), references from the model.
  const appearances = new Map<string, SceneRef[]>();
  const mentionTotals = new Map<string, number>();
  for (const s of sceneMentions) {
    for (const id of s.ids) {
      if (!isNode(id)) continue;
      (appearances.get(id) ?? appearances.set(id, []).get(id)!).push(s.ref);
      mentionTotals.set(id, (mentionTotals.get(id) ?? 0) + (s.mentionCount.get(id) ?? 0));
    }
  }
  const byPath = new Map(notes.map((n) => [n.path, n]));
  const entities: Entity[] = [];
  for (const e of index.entities) {
    entities.push({ id: e.id, name: e.name, kind: e.kind, path: e.path, aliases: e.aliases, bookmarked: byPath.get(e.path)?.bookmarked ?? false, appearances: appearances.get(e.id) ?? [], mentions: mentionTotals.get(e.id) ?? 0 });
  }
  for (const id of candidateIds) {
    entities.push({ id, name: candidateSurface.get(id)!, kind: "candidate", path: null, aliases: [], bookmarked: false, appearances: appearances.get(id) ?? [], mentions: mentionTotals.get(id) ?? 0 });
  }
  for (const note of sorted) {
    if (!isSceneNote(note)) continue;
    if (basenameOf(note.path) === "Story map") continue;
    entities.push({ id: note.path, name: basenameOf(note.path), kind: "note", path: note.path, aliases: [], bookmarked: note.bookmarked, appearances: [], mentions: 0 });
  }

  const edges = new Map<string, Edge>();
  const add = (from: string, to: string, kind: EdgeKind, source: Edge["source"], label: string, evidence: SceneRef | null, stale = false) => {
    if (from === to) return;
    const key = `${kind}|${label.toLowerCase()}|${pairKey(from, to)}`;
    const cur = edges.get(key);
    if (cur) {
      const ev = evidence && !cur.evidence.some((e) => sceneKey(e) === sceneKey(evidence)) ? [...cur.evidence, evidence] : cur.evidence;
      edges.set(key, { ...cur, weight: cur.weight + 1, evidence: ev, stale: cur.stale && stale });
    } else edges.set(key, { from, to, kind, layer: layerOf(kind), source, weight: 1, label, evidence: evidence ? [evidence] : [], stale });
  };

  // Explicit layer: links the writer wrote, and which note an entity appears in.
  const nodeIds = new Set(entities.map((e) => e.id));
  for (const note of sorted) {
    for (const target of new Set(note.links)) if (nodeIds.has(target) && nodeIds.has(note.path)) add(note.path, target, "link", "structure", "", null);
  }
  for (const s of sceneMentions) {
    for (const id of s.ids) if (isNode(id) && nodeIds.has(s.note.path)) add(id, s.note.path, "appearance", "extracted", "", s.ref);
  }

  // Internal layer: who shares a scene with whom.
  for (const s of sceneMentions) {
    const ids = [...s.ids].filter(isNode).sort();
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) add(ids[a]!, ids[b]!, "co-occurrence", "extracted", "", s.ref);
  }

  // Model layers: relations (internal) and references (external), keyed back to entities by name.
  const names = new NameLookup<string>();
  for (const e of entities) {
    names.add(e.name, e.id);
    for (const a of e.aliases) names.add(a, e.id);
  }
  const hashes = new Map(sceneMentions.map((s) => [sceneKey(s.ref), textHash(s.scene.prose)]));
  const eventsByScene = new Map<string, string[]>();
  for (const r of file.readings) {
    const key = sceneKey(r.scene);
    const current = hashes.get(key);
    if (current === undefined) continue; // scene no longer exists
    const stale = current !== r.hash;
    const ref = sceneMentions.find((s) => sceneKey(s.ref) === key)!.ref;
    for (const rel of r.relations) {
      const from = names.resolve(rel.from), to = names.resolve(rel.to);
      if (from && to) add(from, to, "relationship", "model", rel.label, ref, stale);
    }
    for (const x of r.references) {
      const id = `ref:${normalise(x.name)}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        entities.push({ id, name: x.name, kind: "reference", path: null, aliases: [], bookmarked: false, appearances: [], mentions: 0 });
      }
      const about = (x.about && names.resolve(x.about)) || ref.path;
      add(about, id, "reference", "model", x.kind === "other" ? x.note : `${x.kind}: ${x.note}`, ref, stale);
    }
    eventsByScene.set(key, r.events.map((e) => e.summary));
  }

  // Headings with no prose under them (outlines, checklists) are structure, not scenes.
  const timeline: TimelineRow[] = sceneMentions
    .map((s) => ({
      scene: s.ref,
      words: countWords(s.scene.prose),
      bookmarked: s.note.bookmarkedHeadings.includes(s.scene.title),
      present: [...s.ids].filter(isNode),
      events: eventsByScene.get(sceneKey(s.ref)) ?? [],
    }))
    .filter((row) => row.words > 0);

  return { project, entities, edges: [...edges.values()], timeline };
}
