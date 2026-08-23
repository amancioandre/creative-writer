/** Function words excluded from repetition checks. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "and", "or", "but", "nor", "so", "yet", "for", "of", "in", "on", "at", "to", "from", "by", "with",
  "about", "into", "onto", "over", "under", "through", "between", "among", "against", "without", "within", "upon",
  "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did",
  "doing", "will", "would", "shall", "should", "can", "could", "may", "might", "must", "ought",
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "he", "him", "his", "himself", "she", "her",
  "hers", "herself", "it", "its", "itself", "we", "us", "our", "ours", "ourselves", "they", "them", "their", "theirs",
  "themselves", "this", "that", "these", "those", "who", "whom", "whose", "which", "what", "where", "when", "why",
  "how", "there", "here", "then", "than", "as", "if", "not", "no", "yes", "all", "any", "some", "each", "every",
  "both", "few", "more", "most", "other", "such", "only", "own", "same", "too", "very", "just", "also", "now",
  "again", "once", "still", "even", "ever", "never", "always", "often", "back", "up", "down", "out", "off", "away",
  "said", "says", "one", "two", "like", "get", "got", "go", "went", "come", "came", "made", "make", "thing", "things",
  "well", "much", "many", "little", "long", "way", "time", "day", "man", "woman", "look", "looked", "know", "knew",
  "don't", "didn't", "doesn't", "isn't", "wasn't", "weren't", "can't", "couldn't", "won't", "wouldn't", "shouldn't",
  "i'm", "i've", "i'd", "i'll", "he's", "she's", "it's", "we're", "they're", "you're", "that's", "there's", "what's",
]);
