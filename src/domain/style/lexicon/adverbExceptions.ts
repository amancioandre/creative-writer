/** Words ending in -ly that are not adverbs (or are adverbs worth leaving alone). */
export const LY_NOT_ADVERB: ReadonlySet<string> = new Set([
  // adjectives / nouns
  "family", "italy", "july", "ally", "belly", "bully", "jelly", "lily", "rally", "tally", "folly", "holly", "jolly",
  "silly", "ugly", "friendly", "unfriendly", "lonely", "lovely", "deadly", "lively", "elderly", "orderly", "disorderly",
  "daily", "weekly", "monthly", "yearly", "nightly", "hourly", "early", "butterfly", "dragonfly", "firefly", "assembly",
  "anomaly", "melancholy", "monopoly", "supply", "reply", "apply", "imply", "comply", "multiply", "rely", "bodily",
  "burly", "curly", "surly", "wily", "oily", "holy", "unholy", "wholly", "ghastly", "ghostly", "goodly", "godly",
  "heavenly", "earthly", "worldly", "otherworldly", "manly", "womanly", "motherly", "fatherly", "brotherly", "sisterly",
  "kingly", "queenly", "princely", "knightly", "beastly", "cowardly", "miserly", "scholarly", "leisurely", "timely",
  "untimely", "costly", "homely", "comely", "seemly", "unseemly", "sickly", "prickly", "crinkly", "wrinkly", "sparkly",
  "bubbly", "cuddly", "giggly", "wobbly", "woolly", "chilly", "hilly", "frilly", "smelly", "shapely", "stately",
  "likely", "unlikely", "only", "lowly", "measly", "grisly", "gnarly", "pearly", "portly", "steely", "unruly",
  "fly", "sly", "ply", "gully", "sully", "dolly", "molly", "polly", "sally", "dally", "rely",
  // adverbs that are not style problems (structural rather than manner)
  "only", "really", "early", "likely", "unlikely", "namely", "merely", "barely", "hardly", "nearly", "mostly",
  "partly", "mainly", "largely", "usually", "finally", "especially", "particularly", "generally", "possibly",
  "probably", "exactly", "recently", "currently", "previously", "eventually", "immediately", "originally",
  "ultimately", "apparently", "presumably", "supposedly", "formerly", "lately", "firstly", "secondly", "thirdly",
  "lastly", "hopefully", "thankfully", "admittedly", "reportedly", "allegedly",
]);

/** Dialogue tags: an adverb immediately after one of these is the Tom Swifty pattern. */
export const DIALOGUE_TAGS: ReadonlySet<string> = new Set([
  "said", "says", "asked", "asks", "replied", "replies", "answered", "whispered", "shouted", "muttered", "murmured",
  "cried", "called", "yelled", "screamed", "hissed", "growled", "snapped", "sighed", "laughed", "added", "continued",
  "repeated", "demanded", "insisted", "admitted", "agreed", "argued", "begged", "breathed", "declared", "exclaimed",
  "explained", "grumbled", "mumbled", "noted", "observed", "offered", "ordered", "pleaded", "prompted", "protested",
  "remarked", "responded", "retorted", "snarled", "sobbed", "spat", "stammered", "stated", "suggested", "told",
  "urged", "warned", "wondered", "countered", "conceded", "croaked", "drawled", "gasped", "groaned", "moaned",
  "purred", "rasped", "scoffed", "sneered", "snorted", "squeaked", "wailed", "whined", "whimpered",
]);
