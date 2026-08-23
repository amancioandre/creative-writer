/** Irregular past participles that do not end in -ed/-en/-t patterns we can guess. */
export const IRREGULAR_PARTICIPLES: ReadonlySet<string> = new Set([
  "been", "begun", "bitten", "blown", "broken", "brought", "built", "bought", "caught", "chosen", "come", "cut",
  "done", "drawn", "driven", "drunk", "eaten", "fallen", "fed", "felt", "fought", "found", "flown", "forgiven",
  "forgotten", "frozen", "given", "gone", "grown", "had", "heard", "held", "hidden", "hit", "hurt", "kept",
  "known", "laid", "led", "left", "lent", "let", "lost", "made", "meant", "met", "paid", "put", "read", "ridden",
  "risen", "run", "said", "seen", "sent", "set", "shaken", "shot", "shown", "shut", "sung", "sunk", "sat", "slept",
  "spoken", "spent", "spun", "stolen", "struck", "stuck", "sung", "sworn", "swept", "swum", "taken", "taught",
  "told", "thought", "thrown", "torn", "understood", "woken", "worn", "won", "written", "bound", "bred", "cast",
  "clung", "dealt", "dug", "fled", "flung", "ground", "hung", "knelt", "lit", "slain", "slid", "sold", "sought",
  "sown", "spat", "split", "spread", "sprung", "stood", "strung", "stung", "stunk", "swung", "trodden", "wound",
  "wrung", "beaten", "bent", "bled", "burnt", "dreamt", "learnt", "leapt", "spelt", "spilt", "spoilt", "smelt",
]);

/**
 * be + participle that is almost always a state adjective, not a passive.
 * "I am interested" is not "someone interests me".
 */
export const STATIVE_PARTICIPLES: ReadonlySet<string> = new Set([
  "interested", "excited", "bored", "tired", "worried", "surprised", "pleased", "satisfied", "disappointed",
  "frightened", "scared", "confused", "embarrassed", "exhausted", "relieved", "annoyed", "amused", "ashamed",
  "delighted", "devoted", "determined", "married", "engaged", "related", "involved", "concerned", "convinced",
  "prepared", "qualified", "experienced", "educated", "accustomed", "used", "supposed", "gone", "done", "finished",
  "lost", "stuck", "drunk", "dressed", "seated", "retired", "located", "situated", "crowded", "closed", "open",
  "broken", "torn", "worn", "hidden", "known", "unknown", "aged", "advanced", "armed", "blessed", "cursed",
  "damned", "beloved", "alone", "asleep", "awake", "alive", "afraid", "aware", "allowed", "obliged",
]);
