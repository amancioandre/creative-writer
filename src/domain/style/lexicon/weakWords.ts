/**
 * Words that weaken prose by hedging, inflating, or narrating instead of
 * showing. Each entry has a note the tooltip will display.
 *
 * Two kinds:
 *   "weak"   — intensifiers, hedges, crutch phrases. Cut or replace with a
 *              stronger word.
 *   "filter" — perception/cognition verbs that put the narrator between the
 *              reader and the experience ("she saw the door open" → "the
 *              door opened").
 */
export interface WeakEntry {
  readonly phrase: string;
  readonly kind: "weak" | "filter";
  readonly note: string;
}

const w = (phrase: string, note: string): WeakEntry => ({ phrase, kind: "weak", note });
const f = (phrase: string, note: string): WeakEntry => ({ phrase, kind: "filter", note });

export const WEAK_WORDS: readonly WeakEntry[] = [
  // intensifiers — they dilute the word they modify
  w("very", "Intensifier. Find a stronger word instead: \"very tired\" → \"exhausted\"."),
  w("really", "Intensifier. Usually deletable without loss."),
  w("extremely", "Intensifier. Pick a word that already carries the extreme."),
  w("incredibly", "Intensifier. Says the thing is hard to believe rather than showing why."),
  w("totally", "Intensifier. Almost always deletable."),
  w("completely", "Intensifier. Often redundant: \"completely destroyed\"."),
  w("absolutely", "Intensifier. Almost always deletable."),
  w("utterly", "Intensifier. Earns its place rarely."),
  w("literally", "Usually means \"figuratively\" or nothing. Cut it."),
  w("so", "Intensifier before an adjective. Try the adjective alone, or a sharper one."),
  w("truly", "Intensifier. Cut it."),
  w("highly", "Intensifier. Cut it or choose a stronger head word."),
  w("deeply", "Intensifier. Often cliché in \"deeply moved\", \"deeply troubled\"."),
  w("terribly", "Intensifier. Cut it."),
  w("awfully", "Intensifier. Cut it."),
  w("remarkably", "Intensifier. Show what makes it remarkable."),

  // hedges — they retreat from the claim
  w("quite", "Hedge. Commit or cut."),
  w("rather", "Hedge. Commit or cut."),
  w("somewhat", "Hedge. Commit or cut."),
  w("fairly", "Hedge. Commit or cut."),
  w("pretty", "Hedge when used as \"pretty cold\". Commit or cut."),
  w("slightly", "Hedge. Is the slightness the point? If not, cut."),
  w("a bit", "Hedge. Commit or cut."),
  w("a little", "Hedge. Commit or cut."),
  w("kind of", "Hedge. Commit or cut."),
  w("sort of", "Hedge. Commit or cut."),
  w("almost", "Hedge. If it nearly happened, decide whether \"nearly\" matters."),
  w("nearly", "Hedge. Decide whether the nearness matters."),
  w("perhaps", "Hedge. Fine in a character's voice; weak in narration."),
  w("maybe", "Hedge. Fine in a character's voice; weak in narration."),
  w("seemingly", "Hedge. Either it is or it isn't — or the doubt is the point."),
  w("apparently", "Hedge. Who is it apparent to?"),
  w("basically", "Filler. Cut it."),
  w("essentially", "Filler. Cut it."),
  w("actually", "Filler. Cut it unless contrasting with a false belief."),
  w("certainly", "Filler. Assertions don't need a certificate."),
  w("definitely", "Filler. Cut it."),
  w("obviously", "If it's obvious, don't say it; if it isn't, don't claim it."),
  w("of course", "Filler. Cut it unless it's a character's voice."),
  w("just", "Filler. Cut it — nine times in ten the sentence is stronger without."),
  w("simply", "Filler. Cut it."),
  w("virtually", "Hedge. Cut it."),

  // crutch constructions — narrate the start of an action instead of the action
  w("started to", "Crutch. \"Started to run\" → \"ran\", unless the start is interrupted."),
  w("began to", "Crutch. \"Began to cry\" → \"cried\", unless the beginning is the point."),
  w("proceeded to", "Crutch. Cut it and use the verb."),
  w("managed to", "Crutch. Show the difficulty or cut it."),
  w("tried to", "Crutch. Did they or didn't they? If they failed, show the failure."),
  w("attempted to", "Crutch. Did they or didn't they?"),
  w("seemed to", "Crutch. Commit, or make the uncertainty the point."),
  w("appeared to", "Crutch. Commit, or make the uncertainty the point."),
  w("tended to", "Crutch. Habitual action is stronger as a concrete instance."),
  w("in order to", "Wordy. \"To\" does the job."),
  w("due to the fact that", "Wordy. \"Because\"."),
  w("in spite of the fact that", "Wordy. \"Although\"."),
  w("the fact that", "Wordy. Usually cuttable."),
  w("at this point in time", "Wordy. \"Now\"."),
  w("for the purpose of", "Wordy. \"To\"."),
  w("in the event that", "Wordy. \"If\"."),
  w("there was", "Weak opener. \"There was a man at the door\" → \"A man stood at the door\"."),
  w("there were", "Weak opener. Lead with the subject and a real verb."),
  w("there is", "Weak opener. Lead with the subject and a real verb."),
  w("there are", "Weak opener. Lead with the subject and a real verb."),
  w("it was as if", "Crutch for a simile. Try stating the image directly."),
  w("as though", "Often a crutch. Check whether the comparison is earning its place."),
  w("suddenly", "Announces surprise instead of creating it. Cut; let the short sentence do the work."),
  w("all of a sudden", "Announces surprise instead of creating it. Cut it."),
  w("in that moment", "Filler. The sentence is already in that moment."),
  w("at that moment", "Filler. The sentence is already at that moment."),
  w("found myself", "Crutch. \"I found myself walking\" → \"I walked\"."),
  w("found himself", "Crutch. \"He found himself walking\" → \"He walked\"."),
  w("found herself", "Crutch. \"She found herself walking\" → \"She walked\"."),
  w("couldn't help but", "Crutch. Cut and state the action."),
  w("could not help but", "Crutch. Cut and state the action."),

  // POV filter verbs — they narrate perception instead of rendering it
  f("saw", "Filter verb. Render what was seen, not the seeing: \"she saw the door open\" → \"the door opened\"."),
  f("see", "Filter verb. Render what is seen directly."),
  f("watched", "Filter verb. Render what was watched directly."),
  f("noticed", "Filter verb. Render what was noticed directly."),
  f("observed", "Filter verb. Render what was observed directly."),
  f("spotted", "Filter verb. Render what was spotted directly."),
  f("heard", "Filter verb. Render the sound: \"she heard a crash\" → \"something crashed\"."),
  f("hear", "Filter verb. Render the sound directly."),
  f("listened", "Filter verb. Render the sound directly."),
  f("felt", "Filter verb. Render the sensation: \"she felt cold\" → \"the cold got into her bones\"."),
  f("feel", "Filter verb. Render the sensation directly."),
  f("smelled", "Filter verb. Render the smell directly."),
  f("tasted", "Filter verb. Render the taste directly."),
  f("sensed", "Filter verb. Render it — or show what was sensed through a concrete detail."),
  f("realized", "Filter verb. Render the realisation's content, not the act of realising."),
  f("realised", "Filter verb. Render the realisation's content, not the act of realising."),
  f("knew", "Filter verb. State the fact in the narrator's voice."),
  f("thought", "Filter verb. In close POV the narration already is thought."),
  f("wondered", "Filter verb. Ask the question directly in free indirect style."),
  f("decided", "Filter verb. Show the action that follows the decision."),
  f("remembered", "Filter verb. Drop into the memory directly."),
  f("recalled", "Filter verb. Drop into the memory directly."),
  f("seemed", "Filter verb. Commit, or make the doubt the point."),
  f("experienced", "Filter verb. Render the experience."),
];
