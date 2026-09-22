import { parseTemplate, type StoryTemplate } from "./Templates";

/**
 * The templates that ship in the plugin, written in the same markdown a
 * saved one uses, so what the writer reads in the sheet is what a note
 * would say. Hard-coded and never fetched.
 */
const THREE_ACTS = `---
creative-writer-template: 1
plot-theme: Theme: Main theme
plot-beats: Plot point
---
# Columns
## Plot point
## Theme: Main theme

# Act I
### Opening
<!-- The world as it is, and who lives in it -->
<!-- beat: Opening -->
### Inciting incident
<!-- The thing that happens that cannot be undone -->
<!-- beat: Inciting incident -->
### First turn
<!-- The choice that commits the hero to the story -->
<!-- beat: First turn -->

# Act II
### Rising action
<!-- Trying and failing; the stakes climb -->
<!-- beat: Rising action -->
### Midpoint
<!-- A false win or a false loss that changes what the hero wants -->
<!-- beat: Midpoint -->
### Crisis
<!-- Everything lost; the hardest choice ahead -->
<!-- beat: Crisis -->

# Act III
### Climax
<!-- The choice made, at full cost -->
<!-- beat: Climax -->
### Falling action
<!-- What the choice sets loose -->
<!-- beat: Falling action -->
### Resolution
<!-- The world as it is now -->
<!-- beat: Resolution -->
`;

const SAVE_THE_CAT = `---
creative-writer-template: 1
plot-theme: Theme: Main theme
plot-beats: Plot point
---
# Columns
## Plot point
## Theme: Main theme
## Subplot: B story

# Act I
### Opening image
<!-- A snapshot of the hero before anything changes -->
<!-- beat: Opening image -->
### Theme stated
<!-- Someone says what the story is about; the hero does not hear it -->
<!-- beat: Theme stated -->
### Set-up
<!-- The hero's world, and what is missing from it -->
<!-- beat: Set-up -->
### Catalyst
<!-- The event that ends the old life -->
<!-- beat: Catalyst -->
### Debate
<!-- The hero hesitates: should I go? -->
<!-- beat: Debate -->
### Break into two
<!-- The hero chooses the new world -->
<!-- beat: Break into two -->

# Act II
### B story
<!-- A new relationship that carries the theme -->
<!-- beat: B story -->
### Fun and games
<!-- The promise of the premise -->
<!-- beat: Fun and games -->
### Midpoint
<!-- A false win or a false loss; the stakes go up -->
<!-- beat: Midpoint -->
### Bad guys close in
<!-- Pressure from outside, doubt from inside -->
<!-- beat: Bad guys close in -->
### All is lost
<!-- The lowest point; something dies -->
<!-- beat: All is lost -->
### Dark night of the soul
<!-- The hero sits with the loss -->
<!-- beat: Dark night of the soul -->
### Break into three
<!-- The B story gives the answer -->
<!-- beat: Break into three -->

# Act III
### Finale
<!-- The hero uses what was learned -->
<!-- beat: Finale -->
### Final image
<!-- The opposite of the opening image -->
<!-- beat: Final image -->
`;

const HEROS_JOURNEY = `---
creative-writer-template: 1
plot-theme: Theme: Main theme
plot-beats: Plot point
---
# Columns
## Plot point
## Theme: Main theme

# Departure
### Ordinary world
<!-- The hero at home, before the call -->
<!-- beat: Ordinary world -->
### Call to adventure
<!-- The problem or the invitation -->
<!-- beat: Call to adventure -->
### Refusal of the call
<!-- Fear, doubt, a reason to stay -->
<!-- beat: Refusal of the call -->
### Meeting the mentor
<!-- Advice, a tool, a push -->
<!-- beat: Meeting the mentor -->
### Crossing the threshold
<!-- The hero commits and the world changes -->
<!-- beat: Crossing the threshold -->

# Initiation
### Tests, allies, enemies
<!-- The rules of the new world learned the hard way -->
<!-- beat: Tests, allies, enemies -->
### Approach to the inmost cave
<!-- Preparation for the central ordeal -->
<!-- beat: Approach to the inmost cave -->
### Ordeal
<!-- The hero faces the greatest fear; a death of some kind -->
<!-- beat: Ordeal -->
### Reward
<!-- What the ordeal earned -->
<!-- beat: Reward -->

# Return
### The road back
<!-- The choice to return, and what chases the hero -->
<!-- beat: The road back -->
### Resurrection
<!-- The final test, the hero remade -->
<!-- beat: Resurrection -->
### Return with the elixir
<!-- Home, changed, with something that helps others -->
<!-- beat: Return with the elixir -->
`;

const ARC_PER_CHARACTER = `---
creative-writer-template: 1
plot-theme: Theme: Main theme
---
## Arc: every character
## Theme: Main theme
`;

const STORY_ANALYSIS = `---
creative-writer-template: 1
plot-time: Time
plot-pov: POV
plot-theme: Theme: Major theme
plot-beats: Plot point
---
## Chapter number
## Time
## POV
## Plot point
## Main plot
## Theme: Major theme
## Subplot: Subplot 1
## Subplot: Subplot 2
## Arc: Character A
## Arc: Character B
`;

export const BUILT_IN_TEMPLATES: readonly StoryTemplate[] = [
  parseTemplate(THREE_ACTS, "Three acts"),
  parseTemplate(SAVE_THE_CAT, "Save the Cat"),
  parseTemplate(HEROS_JOURNEY, "Hero's journey"),
  parseTemplate(ARC_PER_CHARACTER, "An arc per character"),
  parseTemplate(STORY_ANALYSIS, "Story analysis"),
];
