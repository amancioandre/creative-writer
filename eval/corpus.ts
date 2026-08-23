import type { FindingKind } from "../src/domain/style/Finding";

/**
 * Labelled sentences. `expect` lists every kind an editor would flag; an
 * empty list means "leave this alone". Labels are sentence-level on
 * purpose: the question is "did the checker notice", not "exact span".
 *
 * Keep roughly balanced: each kind has positives, and the clean set is
 * large enough that precision means something.
 */
export interface Labelled {
  readonly text: string;
  readonly expect: readonly FindingKind[];
}

const s = (text: string, ...expect: FindingKind[]): Labelled => ({ text, expect });

export const CORPUS: readonly Labelled[] = [
  // --- cliche ---
  s("At the end of the day, it was her choice.", "cliche"),
  s("He avoided the subject like the plague.", "cliche"),
  s("A chill ran down her spine as the door creaked.", "cliche", "metaphor"),
  s("She let out a breath she didn't know she was holding.", "cliche"),
  s("They were two peas in a pod.", "cliche"),
  s("It was a blessing in disguise.", "cliche"),
  s("The writing was on the wall for the old factory.", "cliche"),
  s("His heart pounded in his chest.", "cliche"),
  s("Time heals all wounds, her mother said.", "cliche"),
  s("He fought tooth and nail for the contract.", "cliche"),
  s("It was the calm before the storm.", "cliche"),
  s("She was a diamond in the rough.", "cliche"),

  // --- passive ---
  s("The letter was written by her brother.", "passive"),
  s("Mistakes were made.", "passive"),
  s("The bridge was built in a single summer.", "passive"),
  s("He had been forgotten by everyone.", "passive"),
  s("The window was broken by the wind.", "passive"),
  s("The verdict was reached after an hour.", "passive"),
  s("She was given a second chance.", "passive"),
  s("The city got destroyed in the flood.", "passive"),
  s("The results will be announced tomorrow.", "passive"),
  s("A decision had been taken without him.", "passive"),

  // --- weak ---
  s("It was very cold in the hall.", "weak"),
  s("She was really quite tired by then.", "weak"),
  s("He just wanted to go home.", "weak"),
  s("They started to run toward the gate.", "weak"),
  s("The room seemed to shrink around her.", "weak"),
  s("It was basically a disaster.", "weak"),
  s("She began to cry.", "weak"),
  s("There was a man standing at the door.", "weak"),
  s("He was somewhat relieved.", "weak"),
  s("Suddenly, the lights went out.", "weak"),

  // --- filter ---
  s("She saw the door swing open.", "filter"),
  s("He heard a car pull into the drive.", "filter"),
  s("She felt the cold creep up her arms.", "filter"),
  s("I noticed the letter on the table.", "filter"),
  s("He realised the room was empty.", "filter"),
  s("She watched the rain streak the glass.", "filter"),
  s("He wondered whether she would come.", "filter"),
  s("I knew then that he was lying.", "filter"),

  // --- adverb ---
  s("She walked slowly across the room.", "adverb"),
  s("\"Go,\" he said quietly.", "adverb"),
  s("He carefully placed the cup on the saucer.", "adverb"),
  s("They spoke softly in the dark.", "adverb"),
  s("She angrily slammed the drawer.", "adverb"),
  s("\"I hate you,\" she whispered furiously.", "adverb"),
  s("The dog ran happily across the field.", "adverb"),

  // --- repetition ---
  s("The garden was quiet. The garden waited. The garden held its breath.", "repetition"),
  s("She opened the door. She looked inside. She screamed.", "repetition"),
  s("The light was cold and the light was grey and the light did not move.", "repetition"),
  s("He walked to the window. He walked back. He walked to the window again.", "repetition"),

  // --- nominalization ---
  s("She made a decision to leave.", "nominalization"),
  s("They reached an agreement by noon.", "nominalization"),
  s("He gave an explanation nobody wanted.", "nominalization"),
  s("We conducted an investigation into the matter.", "nominalization"),
  s("She came to the conclusion that he was right.", "nominalization"),
  s("He made an attempt to stand.", "nominalization"),
  s("They had a discussion about the will.", "nominalization"),

  // --- weakverb ---
  s("The room at the end of the long corridor on the second floor of the old house was very cold and dark.", "weakverb", "weak"),
  s("The garden behind the house at the bottom of the lane past the church was a tangle of nettles and broken glass.", "weakverb", "metaphor"),
  s("The house on the hill above the quiet village by the river was old and grey and tired.", "weakverb"),
  s("The man in the grey coat by the far window of the station café was a stranger to all of them.", "weakverb"),

  // --- metaphor (candidates, dead, mixed) ---
  s("The silence bruised him.", "metaphor"),
  s("Grief swallowed the house.", "metaphor"),
  s("A velvet silence settled over the room.", "metaphor"),
  s("Fear crawled up his spine.", "metaphor"),
  s("A flood of memories hit her.", "metaphor", "cliche"),
  s("His sorrow was a stone in his chest.", "metaphor"),
  s("Doubt gnawed at her all afternoon.", "metaphor"),
  s("The news hammered his hope flat.", "metaphor"),
  s("Justice is a blade that cuts both ways.", "metaphor"),
  s("The idea bled into everything she wrote.", "metaphor"),
  s("Shame crept into her voice.", "metaphor"),
  s("A wave of nausea rolled through him.", "metaphor", "cliche"),

  // --- clean: leave alone ---
  s("The knife cut the bread."),
  s("She hammered the nail into the wall."),
  s("The dog swallowed the bone."),
  s("He bruised his knee on the table."),
  s("The fire burned the barn."),
  s("The cat crawled under the bed."),
  s("The velvet curtain hung to the floor."),
  s("They discussed the idea for an hour."),
  s("The silence lasted a minute."),
  s("The river flooded the valley."),
  s("The stone was heavy."),
  s("He ate the bread."),
  s("She was tired and he was running."),
  s("They walked home."),
  s("I am interested in this."),
  s("The sky was red."),
  s("The window was open."),
  s("The body was found at dawn."),
  s("Just as she left, the phone rang."),
  s("The lonely, friendly, elderly family in Italy had a rally early in July."),
  s("He ran. He fell."),
  s("She made a cake."),
  s("He gave a speech to the nation."),
  s("The clock struck nine and the street emptied."),
  s("Marcus poured the tea and said nothing."),
  s("Rain came in sideways off the sea."),
  s("The boy counted the coins twice and put them back in the jar."),
  s("Her mother's letters were kept in a biscuit tin under the bed."),
  s("The train left at six."),
  s("Nobody answered."),
  s("We sat on the wall and watched the tide go out."),
  s("He took the stairs two at a time."),
  s("The bread was stale but the butter was good."),
  s("Across the square, a bell began its slow count."),
  s("The door was locked."),
  s("It was late."),
];
